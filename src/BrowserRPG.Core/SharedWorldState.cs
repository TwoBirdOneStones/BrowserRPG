namespace BrowserRPG.Core;

public readonly record struct BlockChange(
    int X,
    int Y,
    BlockType Block
);

public sealed class SharedWorldState
{
    private readonly object _lock = new();
    private readonly World _world;

    public int Width => _world.Width;
    public int Height => _world.Height;

    public event Action<BlockChange>? BlockChanged;

    public SharedWorldState(World world)
    {
        _world = world;
    }

    public byte[] GetSnapshot()
    {
        lock (_lock)
        {
            return _world.ToByteArray();
        }
    }

    public bool TryEditBlock(int x, int y, string action)
    {
        BlockChange change;

        lock (_lock)
        {
            if (y < 0 || y >= _world.Height) return false;

            int wrappedX = _world.WrapX(x);

            BlockType current = _world.GetBlock(wrappedX, y);

            BlockType? replacement = action switch
            {
                "mine" when current != BlockType.Air => BlockType.Air,
                "place" when current == BlockType.Air => BlockType.Dirt,
                _ => null
            };

            if (replacement is null) return false;

            _world.SetBlock(wrappedX, y, replacement.Value);

            change = new BlockChange(
                wrappedX,
                y,
                replacement.Value
            );
        }

        // Notify subscribers after releasing the lock.
        BlockChanged?.Invoke(change);

        return true;
    }
}
