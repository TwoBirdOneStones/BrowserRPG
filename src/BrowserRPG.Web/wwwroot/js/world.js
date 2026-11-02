
const TILE_SIZE = 32;

// Physics values are measured in blocks and seconds.
const WALK_SPEED = 4;
const GRAVITY = 28;
const JUMP_SPEED = 10;
const MAX_FALL_SPEED = 18;
const FIXED_DT = 1 / 60;

// Player collision dimensions, in blocks.
const PLAYER_HALF_WIDTH = 0.28;
const PLAYER_HEIGHT = 1.6;
const EPSILON = 0.0001;

let stopCurrentWorld = null;

let activeTool = "move";

export function setTool(tool) {
    if (!["move", "mine", "place"].includes(tool)) {
        throw new Error(`Unknown tool: ${tool}`);
    }

    activeTool = tool;
}

export function start(canvas, width, height, tiles) {
    stop();

    activeTool = "move";

    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error("Canvas 2D is unavailable.");
    }

    const blocks = new Uint8Array(tiles);

    const wrapX = x => ((x % width) + width) % width;

    function getBlock(x, y) {
        if (y < 0) return 0;      // Air above world
        if (y >= height) return 3; // Solid bottom boundary

        return blocks[y * width + wrapX(x)];
    }

    function isSolid(x, y) {
        return getBlock(x, y) !== 0;
    }

    // Test the player's AABB against nearby blocks.
    function collides(x, feetY) {
        const minX = Math.floor(
            x - PLAYER_HALF_WIDTH + EPSILON
        );
        const maxX = Math.floor(
            x + PLAYER_HALF_WIDTH - EPSILON
        );

        const minY = Math.floor(
            feetY - PLAYER_HEIGHT + EPSILON
        );
        const maxY = Math.floor(feetY - EPSILON);

        for (let ty = minY; ty <= maxY; ty++) {
            for (let tx = minX; tx <= maxX; tx++) {
                if (isSolid(tx, ty)) {
                    return true;
                }
            }
        }

        return false;
    }


    function blockOverlapsPlayer(tileX, tileY) {
        const playerLeft = player.x - PLAYER_HALF_WIDTH;
        const playerRight = player.x + PLAYER_HALF_WIDTH;

        const playerTop = player.y - PLAYER_HEIGHT;
        const playerBottom = player.y;

        const blockLeft = tileX;
        const blockRight = tileX + 1;

        const blockTop = tileY;
        const blockBottom = tileY + 1;

        return (
            playerLeft < blockRight - EPSILON &&
            playerRight > blockLeft + EPSILON &&
            playerTop < blockBottom - EPSILON &&
            playerBottom > blockTop + EPSILON
        );
    }


    // Find the ground for the initial spawn.
    function findSpawnY(x) {
        for (let y = 0; y < height; y++) {
            if (isSolid(Math.floor(x), y)) {
                return y;
            }
        }

        return height;
    }

    const player = {
        x: 6.5,
        y: findSpawnY(6.5),
        vy: 0,
        grounded: true
    };

    let destinationX = null;
    let destinationY = null;
    let jumpQueued = false;

    let cameraX = 0;
    let cameraY = 0;

    let viewWidth = 1;
    let viewHeight = 1;

    let frameId = 0;
    let lastTime = performance.now();
    let accumulator = 0;

    const heldKeys = new Set();

    function resize() {
        const rect = canvas.getBoundingClientRect();
        const scale = Math.min(
            window.devicePixelRatio || 1, 2
        );

        viewWidth = rect.width;
        viewHeight = rect.height;

        canvas.width = Math.round(viewWidth * scale);
        canvas.height = Math.round(viewHeight * scale);

        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.imageSmoothingEnabled = false;
    }

    function onKeyDown(event) {
        const key = event.key.toLowerCase();

        const allowed = [
            "a", "d", "w",
            "arrowleft", "arrowright", "arrowup",
            " "
        ];

        if (!allowed.includes(key)) return;

        const active = document.activeElement;

        if (
            ["INPUT", "TEXTAREA", "SELECT", "BUTTON"]
                .includes(active?.tagName) ||
            active?.isContentEditable
        ) {
            return;
        }

        const jumpKey = ["w", "arrowup", " "].includes(key);

        // Queue jump once per key press.
        if (jumpKey && !heldKeys.has(key)) {
            jumpQueued = true;
        }

        heldKeys.add(key);
        event.preventDefault();
    }

    function onKeyUp(event) {
        heldKeys.delete(event.key.toLowerCase());
    }

    
    function onPointerDown(event) {
        
        if (event.pointerType === "mouse" && event.button !== 0) return;

        const rect = canvas.getBoundingClientRect();

        // Convert screen coordinates into world coordinates.
        const worldX = (
            event.clientX - rect.left + cameraX
        ) / TILE_SIZE;

        const worldY = (
            event.clientY - rect.top + cameraY
        ) / TILE_SIZE;

        if (activeTool === "move") {
            destinationX = worldX;
            destinationY = worldY;
        }
        else {
            // Identify the tile that was clicked.
            const tileX = Math.floor(worldX);
            const tileY = Math.floor(worldY);

            // Only permit edits inside the world's height.
            if (tileY < 0 || tileY >= height)
                return;

            // Measure distance from the player's center
            // to the center of the selected tile.
            const blockCenterX = tileX + 0.5;
            const blockCenterY = tileY + 0.5;

            const playerCenterY =
                player.y - PLAYER_HEIGHT / 2;

            const distance = Math.hypot(
                blockCenterX - player.x,
                blockCenterY - playerCenterY
            );

            // Temporary interaction reach: 5 blocks.
            const MAX_REACH = 5;

            if (distance > MAX_REACH)
                return;

            const index =
                tileY * width + wrapX(tileX);

            if (activeTool === "mine") {
                // Replace the selected block with air.
                if (blocks[index] !== 0) {
                    blocks[index] = 0;
                }
            }
            else if (activeTool === "place") {
                // Only place into empty space.
                if (blocks[index] !== 0)
                    return;

                // Don't place inside the player.
                if (blockOverlapsPlayer(tileX, tileY))
                    return;

                // Place a dirt block.
                blocks[index] = 2;
            }
        }

        canvas.focus();
        event.preventDefault();
    }


    // Move on only one axis at a time.
    // Small increments prevent skipping through blocks.
    function moveAxis(axis, amount) {
        if (amount === 0) return false;

        const steps = Math.ceil(Math.abs(amount) / 0.04);
        const step = amount / steps;

        for (let i = 0; i < steps; i++) {
            const nextX = player.x +
                (axis === "x" ? step : 0);

            const nextY = player.y +
                (axis === "y" ? step : 0);

            if (collides(nextX, nextY)) {
                return true;
            }

            player.x = nextX;
            player.y = nextY;
        }

        return false;
    }

    function update(dt) {
        const right = heldKeys.has("d") ||
                      heldKeys.has("arrowright");

        const left = heldKeys.has("a") ||
                     heldKeys.has("arrowleft");

        let direction = Number(right) - Number(left);

        if (direction !== 0) {
            // Manual movement overrides click-to-move.
            destinationX = null;
            destinationY = null;
        }
        else if (destinationX !== null) {
            const delta = destinationX - player.x;

            if (Math.abs(delta) < 0.04) {
                destinationX = null;
                destinationY = null;
            }
            else {
                direction = Math.sign(delta);
            }
        }

        // Horizontal movement and collision.
        const previousX = player.x;

        const hitWall = moveAxis(
            "x", direction * WALK_SPEED * dt
        );

        if (hitWall) {
            destinationX = null;
            destinationY = null;
        }

        // Stop click-to-move at the destination.
        if (destinationX !== null) {
            const reached =
                (direction > 0 && player.x >= destinationX) ||
                (direction < 0 && player.x <= destinationX);

            if (reached) {
                if (!collides(destinationX, player.y)) {
                    player.x = destinationX;
                } else {
                    player.x = previousX;
                }

                destinationX = null;
                destinationY = null;
            }
        }

        // Jumping.
        if (jumpQueued && player.grounded) {
            player.vy = -JUMP_SPEED;
            player.grounded = false;
        }

        jumpQueued = false;

        // Apply gravity.
        player.vy = Math.min(
            player.vy + GRAVITY * dt,
            MAX_FALL_SPEED
        );

        const falling = player.vy >= 0;

        // Vertical movement and collision.
        const hitVertical = moveAxis(
            "y", player.vy * dt
        );

        if (hitVertical) {
            player.vy = 0;
        }

        // Check for ground immediately beneath the feet.
        player.grounded = falling &&
            collides(player.x, player.y + 0.05);
    }

    function draw() {
        ctx.fillStyle = "#8fcbe8";
        ctx.fillRect(0, 0, viewWidth, viewHeight);

        const minX = Math.floor(cameraX / TILE_SIZE) - 1;
        const maxX = Math.ceil(
            (cameraX + viewWidth) / TILE_SIZE
        ) + 1;

        const minY = Math.max(
            0, Math.floor(cameraY / TILE_SIZE) - 1
        );
        const maxY = Math.min(
            height - 1,
            Math.ceil((cameraY + viewHeight) / TILE_SIZE) + 1
        );

        // Render only visible terrain.
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const block = getBlock(x, y);

                if (block === 0) continue;

                const sx = x * TILE_SIZE - cameraX;
                const sy = y * TILE_SIZE - cameraY;

                ctx.fillStyle = block === 3
                    ? "#73818a"
                    : "#855b3d";

                ctx.fillRect(
                    sx, sy, TILE_SIZE + 0.3, TILE_SIZE + 0.3
                );

                if (block === 1) {
                    ctx.fillStyle = "#5bad55";
                    ctx.fillRect(sx, sy, TILE_SIZE, 8);
                }
            }
        }

        // Click/tap destination marker.
        if (destinationX !== null) {
            ctx.strokeStyle = "#ffe266";
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.arc(
                destinationX * TILE_SIZE - cameraX,
                destinationY * TILE_SIZE - cameraY,
                8, 0, Math.PI * 2
            );
            ctx.stroke();
        }

        // Draw player using its physics position.
        const px = player.x * TILE_SIZE - cameraX;
        const py = player.y * TILE_SIZE - cameraY;

        const bodyWidth = PLAYER_HALF_WIDTH * 2 * TILE_SIZE;
        const bodyHeight = PLAYER_HEIGHT * TILE_SIZE;

        const left = px - bodyWidth / 2;
        const top = py - bodyHeight;

        ctx.fillStyle = "#315baf";
        ctx.fillRect(
            left, top + 18,
            bodyWidth, bodyHeight - 18
        );

        ctx.fillStyle = "#f0c29a";
        ctx.fillRect(left, top, bodyWidth, 18);

        ctx.fillStyle = "#292521";
        ctx.fillRect(left + bodyWidth - 6, top + 7, 3, 3);

        // Debug information.
        ctx.font = "14px monospace";
        ctx.fillStyle = "#142434";

        ctx.fillText(
            `X: ${wrapX(Math.floor(player.x))}  ` +
            `Y: ${player.y.toFixed(2)}`,
            12, 24
        );

        ctx.fillText(
            `Grounded: ${player.grounded}  ` +
            `Velocity Y: ${player.vy.toFixed(2)}`,
            12, 44
        );
    }

    function frame(now) {
        const elapsed = Math.min(
            Math.max((now - lastTime) / 1000, 0),
            0.05
        );

        lastTime = now;
        accumulator += elapsed;

        // Simulate physics at 60 fixed steps per second.
        while (accumulator >= FIXED_DT) {
            update(FIXED_DT);
            accumulator -= FIXED_DT;
        }

        cameraX =
            player.x * TILE_SIZE - viewWidth * 0.5;

        cameraY =
            player.y * TILE_SIZE - viewHeight * 0.65;

        draw();

        frameId = requestAnimationFrame(frame);
    }

    function clearKeys() {
        heldKeys.clear();
        jumpQueued = false;
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);

    canvas.addEventListener("pointerdown", onPointerDown);

    resize();
    frameId = requestAnimationFrame(frame);

    stopCurrentWorld = () => {
        cancelAnimationFrame(frameId);
        resizeObserver.disconnect();

        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", clearKeys);
        canvas.removeEventListener("pointerdown", onPointerDown);
    };
}

export function stop() {
    if (stopCurrentWorld) {
        stopCurrentWorld();
        stopCurrentWorld = null;
    }
}