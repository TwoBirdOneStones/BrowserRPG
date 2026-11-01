
const TILE_SIZE = 32;
const WALK_SPEED = 4; // Tiles per second.

let stopCurrentWorld = null;

export function start(canvas, width, height, tiles) {
    stop();

    const ctx = canvas.getContext("2d");

    if (!ctx)
        throw new Error("Canvas 2D is unavailable.");

    // 0 = Air, 1 = Grass, 2 = Dirt, 3 = Stone
    const blocks = new Uint8Array(tiles);

    const surface = new Array(width);

    // Wrap any X coordinate into the world.
    const wrap = x => ((x % width) + width) % width;

    // Find the surface of each world column.
    for (let x = 0; x < width; x++) {
        surface[x] = height - 1;

        for (let y = 0; y < height; y++) {
            if (blocks[y * width + x] === 1) {
                surface[x] = y;
                break;
            }
        }
    }

    // Smooth the character's height between columns.
    const surfaceAt = x => {
        const left = Math.floor(x);
        const t = x - left;

        return surface[wrap(left)] * (1 - t)
             + surface[wrap(left + 1)] * t;
    };

    let playerX = 6;
    let destinationX = null;

    let cameraX = 0;
    let cameraY = 0;

    let viewWidth = 1;
    let viewHeight = 1;

    let frameId = 0;
    let lastFrameTime = performance.now();

    const heldKeys = new Set();

    function resize() {
        const rect = canvas.getBoundingClientRect();
        const scale = Math.min(window.devicePixelRatio || 1, 2);

        viewWidth = rect.width;
        viewHeight = rect.height;

        canvas.width = Math.round(viewWidth * scale);
        canvas.height = Math.round(viewHeight * scale);

        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.imageSmoothingEnabled = false;
    }

    function onKeyDown(event) {
        const key = event.key.toLowerCase();

        if (!["a", "d", "arrowleft", "arrowright"].includes(key))
            return;

        if (["INPUT", "TEXTAREA"].includes(
            document.activeElement?.tagName))
            return;

        heldKeys.add(key);
        event.preventDefault();
    }

    function onKeyUp(event) {
        heldKeys.delete(event.key.toLowerCase());
    }

    function onPointerDown(event) {
        if (event.pointerType === "mouse" && event.button !== 0)
            return;

        const rect = canvas.getBoundingClientRect();

        destinationX =
            (event.clientX - rect.left + cameraX) / TILE_SIZE;

        canvas.focus();
    }

    function draw() {
        // Draw the sky.
        ctx.fillStyle = "#8fcbe8";
        ctx.fillRect(0, 0, viewWidth, viewHeight);

        // Calculate only the visible tile range.
        const minX = Math.floor(cameraX / TILE_SIZE) - 1;
        const maxX =
            Math.ceil((cameraX + viewWidth) / TILE_SIZE) + 1;

        const minY = Math.max(
            0, Math.floor(cameraY / TILE_SIZE) - 1
        );

        const maxY = Math.min(
            height - 1,
            Math.ceil((cameraY + viewHeight) / TILE_SIZE) + 1
        );

        // Draw visible blocks.
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const block = blocks[y * width + wrap(x)];

                if (block === 0)
                    continue;

                const screenX = x * TILE_SIZE - cameraX;
                const screenY = y * TILE_SIZE - cameraY;

                ctx.fillStyle =
                    block === 3 ? "#73818a" : "#855b3d";

                ctx.fillRect(
                    screenX, screenY,
                    TILE_SIZE + 0.3, TILE_SIZE + 0.3
                );

                // Grass top.
                if (block === 1) {
                    ctx.fillStyle = "#5bad55";
                    ctx.fillRect(screenX, screenY, TILE_SIZE, 8);
                }
            }
        }

        // Show the click-to-move destination.
        if (destinationX !== null) {
            const destScreenX =
                destinationX * TILE_SIZE - cameraX;

            const destScreenY =
                surfaceAt(destinationX) * TILE_SIZE - cameraY;

            ctx.strokeStyle = "#ffe266";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(
                destScreenX, destScreenY - 10,
                8, 0, Math.PI * 2
            );
            ctx.stroke();
        }

        // Draw a simple player character.
        const px = playerX * TILE_SIZE - cameraX;
        const feetY = surfaceAt(playerX) * TILE_SIZE - cameraY;

        // Body
        ctx.fillStyle = "#315baf";
        ctx.fillRect(px - 10, feetY - 31, 20, 31);

        // Head
        ctx.fillStyle = "#f0c29a";
        ctx.fillRect(px - 10, feetY - 49, 20, 18);

        // Eye
        ctx.fillStyle = "#292521";
        ctx.fillRect(px + 3, feetY - 42, 3, 3);

        // Debug coordinates.
        ctx.font = "14px monospace";
        ctx.fillStyle = "#142434";
        ctx.fillText(
            `World X: ${wrap(Math.floor(playerX))} / ${width}`,
            12, 24
        );
    }

    function frame(now) {
        const dt = Math.min(
            (now - lastFrameTime) / 1000, 0.05
        );

        lastFrameTime = now;

        const right =
            heldKeys.has("d") || heldKeys.has("arrowright");

        const left =
            heldKeys.has("a") || heldKeys.has("arrowleft");

        const direction = Number(right) - Number(left);

        if (direction !== 0) {
            // Keyboard movement takes priority.
            playerX += direction * WALK_SPEED * dt;
            destinationX = null;
        }
        else if (destinationX !== null) {
            // Basic click-to-move along the surface.
            const delta = destinationX - playerX;
            const step = WALK_SPEED * dt;

            if (Math.abs(delta) <= step) {
                playerX = destinationX;
                destinationX = null;
            }
            else {
                playerX += Math.sign(delta) * step;
            }
        }

        // Follow the player with the camera.
        cameraX = playerX * TILE_SIZE - viewWidth * 0.5;
        cameraY =
            surfaceAt(playerX) * TILE_SIZE - viewHeight * 0.65;

        draw();

        frameId = requestAnimationFrame(frame);
    }

    function clearKeys() {
        heldKeys.clear();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);

    canvas.addEventListener("pointerdown", onPointerDown);

    resize();

    frameId = requestAnimationFrame(frame);

    // Cleanup when the Blazor component is disposed.
    stopCurrentWorld = () => {
        cancelAnimationFrame(frameId);
        resizeObserver.disconnect();

        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", clearKeys);

        canvas.removeEventListener(
            "pointerdown", onPointerDown
        );
    };
}

export function stop() {
    if (stopCurrentWorld) {
        stopCurrentWorld();
        stopCurrentWorld = null;
    }
}
