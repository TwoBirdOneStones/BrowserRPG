using System.Diagnostics;

namespace BrowserRPG.Core;

public readonly record struct PlayerSnapshot(
    Guid Id,
    double X,
    double Y
);

public sealed class PlayerRegistry
{
    public const double WalkSpeed = 4;
    public const double Gravity = 28;
    public const double JumpSpeed = 10;
    public const double MaxFallSpeed = 18;

    public const double PlayerHalfWidth = 0.28;
    public const double PlayerHeight = 1.6;

    private const double Epsilon = 0.0001;
    private const double MaxMovementStep = 0.04;

    private readonly object _lock = new();

    private sealed class PlayerState
    {
        public Guid Id;
        public double X;
        public double Y;
        public double VelocityY;
        public bool Grounded = true;

        public int Direction;
        public bool JumpQueued;
        public long LastInputTime;
    }

    private readonly Dictionary<Guid, PlayerState> _players = new();

    public event Action? Changed;

    public bool HasPlayers
    {
        get
        {
            lock (_lock)
                return _players.Count > 0;
        }
    }

    public Guid Register(double x, double y)
    {
        if (!double.IsFinite(x) || !double.IsFinite(y))
            throw new ArgumentException("Invalid spawn position.");

        Guid id = Guid.NewGuid();

        lock (_lock)
        {
            _players.Add(id, new PlayerState
            {
                Id = id,
                X = x,
                Y = y,
                LastInputTime = Stopwatch.GetTimestamp()
            });
        }

        Changed?.Invoke();
        return id;
    }

    // Clients send intentions, never positions.
    public bool SetInput(Guid id, int direction, bool jump)
    {
        if (direction < -1 || direction > 1)
            return false;

        lock (_lock)
        {
            if (!_players.TryGetValue(id, out var player))
                return false;

            player.Direction = direction;
            player.JumpQueued |= jump;
            player.LastInputTime = Stopwatch.GetTimestamp();
        }

        return true;
    }

    public bool Unregister(Guid id)
    {
        bool removed;

        lock (_lock)
            removed = _players.Remove(id);

        if (removed)
            Changed?.Invoke();

        return removed;
    }

    public PlayerSnapshot[] GetSnapshot()
    {
        lock (_lock)
        {
            return _players.Values
                .Select(p => new PlayerSnapshot(p.Id, p.X, p.Y))
                .ToArray();
        }
    }

    // Run once every server physics tick.
    public void Tick(
        double dt,
        byte[] blocks,
        int width,
        int height)
    {
        if (!double.IsFinite(dt) || dt <= 0 || dt > 0.1)
            throw new ArgumentOutOfRangeException(nameof(dt));

        if (blocks.Length != checked(width * height))
            throw new ArgumentException("Invalid world snapshot.");

        bool changed = false;

        lock (_lock)
        {
            foreach (PlayerState player in _players.Values)
            {
                double previousX = player.X;
                double previousY = player.Y;

                // Stop movement if input messages stop arriving.
                bool inputFresh = Stopwatch.GetElapsedTime(
                    player.LastInputTime
                ).TotalSeconds < 0.3;

                int direction = inputFresh ? player.Direction : 0;

                MoveAxis(
                    player,
                    direction * WalkSpeed * dt,
                    true,
                    blocks,
                    width,
                    height
                );

                if (inputFresh && player.JumpQueued && player.Grounded)
                {
                    player.VelocityY = -JumpSpeed;
                    player.Grounded = false;
                }

                player.JumpQueued = false;

                player.VelocityY = Math.Min(
                    player.VelocityY + Gravity * dt,
                    MaxFallSpeed
                );

                bool falling = player.VelocityY >= 0;

                bool hitVertical = MoveAxis(
                    player,
                    player.VelocityY * dt,
                    false,
                    blocks,
                    width,
                    height
                );

                if (hitVertical)
                    player.VelocityY = 0;

                player.Grounded = falling && Collides(
                    player.X,
                    player.Y + 0.05,
                    blocks,
                    width,
                    height
                );

                if (player.X != previousX || player.Y != previousY)
                    changed = true;
            }
        }

        // Notify browsers outside the registry lock.
        if (changed)
            Changed?.Invoke();
    }

    private static bool MoveAxis(
        PlayerState player,
        double amount,
        bool horizontal,
        byte[] blocks,
        int width,
        int height)
    {
        if (amount == 0)
            return false;

        int steps = (int)Math.Ceiling(
            Math.Abs(amount) / MaxMovementStep
        );

        double step = amount / steps;

        for (int i = 0; i < steps; i++)
        {
            double nextX = player.X + (horizontal ? step : 0);
            double nextY = player.Y + (horizontal ? 0 : step);

            if (Collides(nextX, nextY, blocks, width, height))
                return true;

            player.X = nextX;
            player.Y = nextY;
        }

        return false;
    }

    private static bool Collides(
        double x,
        double feetY,
        byte[] blocks,
        int width,
        int height)
    {
        int minX = (int)Math.Floor(x - PlayerHalfWidth + Epsilon);
        int maxX = (int)Math.Floor(x + PlayerHalfWidth - Epsilon);

        int minY = (int)Math.Floor(feetY - PlayerHeight + Epsilon);
        int maxY = (int)Math.Floor(feetY - Epsilon);

        for (int ty = minY; ty <= maxY; ty++)
        {
            for (int tx = minX; tx <= maxX; tx++)
            {
                if (IsSolid(tx, ty, blocks, width, height))
                    return true;
            }
        }

        return false;
    }

    private static bool IsSolid(
        int x,
        int y,
        byte[] blocks,
        int width,
        int height)
    {
        if (y < 0) return false;
        if (y >= height) return true;

        int wrappedX = ((x % width) + width) % width;

        return blocks[y * width + wrappedX] != 0;
    }
}

