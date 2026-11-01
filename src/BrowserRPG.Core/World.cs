namespace BrowserRPG.Core;

public sealed class World
{
    public BlockType[] Blocks { get; private set; }

    public int Width { get; private set; }
    public int Height { get; private set; }

    public World(int width, int height)
    {
        if (width <= 0) throw new ArgumentOutOfRangeException(nameof(width));
        if (height <= 0) throw new ArgumentOutOfRangeException(nameof(height));

        Width = width;
        Height = height;

        Blocks = new BlockType[checked(width * height)];

    }

    public BlockType GetBlock(int x, int y)
    {
        int index = GetIndex(x, y);
        return Blocks[index];
    }

    public void SetBlock(int x, int y, BlockType block)
    {
        int index = GetIndex(x, y);
        Blocks[index] = block;
    }

    public int WrapX(int x)
    {
        int wrapped = x % Width;

        if (wrapped < 0)
            wrapped += Width;

        return wrapped;
    }

    private int GetIndex(int x, int y)
    {
        if (y < 0 || y >= Height)
            throw new ArgumentOutOfRangeException(nameof(y));

        int wrappedX = WrapX(x);

        return y * Width + wrappedX;
    }

    public byte[] ToByteArray()
    {
        byte[] result = new byte[Blocks.Length];

        for (int i = 0; i < Blocks.Length; i++)
        {
            result[i] = (byte)Blocks[i];
        }

        return result;
    }

}