namespace BrowserRPG.Core
{
    public enum BlockType: byte
    {
        Air = 0,
        Grass = 1,
        Dirt = 2,
        Stone = 3
    }

    public class WorldGenerator
    {
        public const int WIDTH = 256;
        public const int HEIGHT = 256;

        public BlockType[] blocks { get; private set; }

        public WorldGenerator()
        {
            blocks = new BlockType[WIDTH * HEIGHT];
            Generate(); 
        }

        private void Generate()
        {
            for (int x = 0; x < WIDTH; x++)
            {
                double angle = 2.0 * Math.PI * x / WIDTH;

                int surfaceY = 23 + (int)Math.Round(
                    4 * Math.Sin(angle * 3) +
                    2 * Math.Sin(angle * 7)
                );

                for (int y = surfaceY; y < HEIGHT; y++)
                {
                    BlockType blockType;

                    if (y == surfaceY) blockType = BlockType.Grass;
                    else if (y < surfaceY + 5) blockType = BlockType.Dirt;
                    else blockType = BlockType.Stone;

                    blocks[y * WIDTH + x] = blockType;
                }
            }
        }

    }
}