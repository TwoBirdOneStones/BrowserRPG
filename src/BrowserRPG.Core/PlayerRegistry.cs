
namespace BrowserRPG.Core;

public readonly record struct PlayerSnapshot(
    Guid Id,
    double X,
    double Y
);

public sealed class PlayerRegistry
{
    private readonly object _lock = new();

    private readonly Dictionary<Guid, PlayerSnapshot>
        _players = new();

    public event Action? Changed;

    public Guid Register(double x, double y)
    {
        Guid id = Guid.NewGuid();

        lock (_lock)
        {
            _players.Add(
                id,
                new PlayerSnapshot(id, x, y)
            );
        }

        Changed?.Invoke();
        return id;
    }

    public bool UpdatePosition(
        Guid id,
        double x,
        double y)
    {
        if (!double.IsFinite(x) || !double.IsFinite(y))
            return false;

        lock (_lock)
        {
            if (!_players.TryGetValue(id, out var player))
                return false;

            if (player.X == x && player.Y == y)
                return true;

            _players[id] = player with
            {
                X = x,
                Y = y
            };
        }

        Changed?.Invoke();
        return true;
    }

    public bool Unregister(Guid id)
    {
        bool removed;

        lock (_lock)
        {
            removed = _players.Remove(id);
        }

        if (removed)
            Changed?.Invoke();

        return removed;
    }

    public PlayerSnapshot[] GetSnapshot()
    {
        lock (_lock)
        {
            return _players.Values.ToArray();
        }
    }
}
