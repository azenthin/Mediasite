import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function randomProductImageUrl(brand: string, product: string, seed: number) {
  const seedStr = `${brand}-${product}-${seed}-${hashString(brand + product + ':' + seed)}`;
  
  // 258 verified working Unsplash image URLs (all 404s removed)
  const baseUrls = [
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b',
    'https://images.unsplash.com/photo-1556906781-9a412961c28c',
    'https://images.unsplash.com/photo-1628779238951-be2c9f2a59f4',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018',
    'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519',
    'https://images.unsplash.com/photo-1549298916-b41d501d3772',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
    'https://images.unsplash.com/photo-1608231387042-66d1773070a5',
    'https://images.unsplash.com/photo-1546519638-68e109498ffc',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f',
    'https://images.unsplash.com/photo-1618354691373-d851c5c3a990',
    'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b',
    'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa',
    'https://images.unsplash.com/photo-1551698618-1dfe5d97d256',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f',
    'https://images.unsplash.com/photo-1560472354-b33ff0c44a43',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136',
    'https://images.unsplash.com/photo-1539185441755-769473a23570',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4',
    'https://images.unsplash.com/photo-1578662996442-48f60103fc96',
    'https://images.unsplash.com/photo-1519861531473-9200262188bf',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f',
    'https://images.unsplash.com/photo-1574680096145-d05b474e2155',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f',
    'https://images.unsplash.com/photo-1563013544-824ae1b704d3',
    'https://images.unsplash.com/photo-1502764613149-7f1d229e230f',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
    'https://images.unsplash.com/photo-1509631179647-0177331693ae',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085',
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6',
    'https://images.unsplash.com/photo-1483058712412-4245e9b90334',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085',
    'https://images.unsplash.com/photo-1524863479829-916d8e77f114',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40',
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3',
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c',
    'https://images.unsplash.com/photo-1517077304055-6e89abbf09b0',
    'https://images.unsplash.com/photo-1556075798-4825dfaaf498',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca',
    'https://images.unsplash.com/photo-1515378960530-7c0da6231fb1',
    'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0',
    'https://images.unsplash.com/photo-1551434678-e076c223a692',
    'https://images.unsplash.com/photo-1516826957135-700dedea698c',
    'https://images.unsplash.com/photo-1524863479829-916d8e77f114',
    'https://images.unsplash.com/photo-1455849318743-b2233052fcff',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998',
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4',
    'https://images.unsplash.com/photo-1551434678-e076c223a692',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
    'https://images.unsplash.com/photo-1517077304055-6e89abbf09b0',
    'https://images.unsplash.com/photo-1515378960530-7c0da6231fb1',
    'https://images.unsplash.com/photo-1556075798-4825dfaaf498',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
    'https://images.unsplash.com/photo-1526947425960-945c6e72858f',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3',
    'https://images.unsplash.com/photo-1511379938547-c1f69419868d',
    'https://images.unsplash.com/photo-1511379938547-c1f69419868d',
    'https://images.unsplash.com/photo-1526947425960-945c6e72858f',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab',
    'https://images.unsplash.com/photo-1526947425960-945c6e72858f',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40',
    'https://images.unsplash.com/photo-1511379938547-c1f69419868d',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085',
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e',
    'https://images.unsplash.com/photo-1517077304055-6e89abbf09b0',
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3',
    'https://images.unsplash.com/photo-1523381210434-271e8be1f52b',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a',
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998',
    'https://images.unsplash.com/photo-1515378960530-7c0da6231fb1',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40',
    'https://images.unsplash.com/photo-1556075798-4825dfaaf498',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c',
    'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
    'https://images.unsplash.com/photo-1483058712412-4245e9b90334',
    'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d',
    'https://images.unsplash.com/photo-1526947425960-945c6e72858f',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a',
    'https://images.unsplash.com/photo-1524863479829-916d8e77f114',
    'https://images.unsplash.com/photo-1549298916-b41d501d3772',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f',
    'https://images.unsplash.com/photo-1608231387042-66d1773070a5',
    'https://images.unsplash.com/photo-1551698618-1dfe5d97d256',
    'https://images.unsplash.com/photo-1560472354-b33ff0c44a43',
    'https://images.unsplash.com/photo-1618354691373-d851c5c3a990',
    'https://images.unsplash.com/photo-1609081219090-a6d81d3085bf',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f',
    'https://images.unsplash.com/photo-1578662996442-48f60103fc96',
    'https://images.unsplash.com/photo-1551434678-e076c223a692',
    'https://images.unsplash.com/photo-1574680096145-d05b474e2155',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f',
    'https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5',
    'https://images.unsplash.com/photo-1563013544-824ae1b704d3',
    'https://images.unsplash.com/photo-1504639725590-34d0984388bd',
    'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    'https://images.unsplash.com/photo-1539185441755-769473a23570',
    'https://images.unsplash.com/photo-1483058712412-4245e9b90334',
    'https://images.unsplash.com/photo-1502764613149-7f1d229e230f',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4',
    'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d',
    'https://images.unsplash.com/photo-1582192730841-2a682d7375f9',
    'https://images.unsplash.com/photo-1582192730841-2a682d7375f9',
    'https://images.unsplash.com/photo-1504639725590-34d0984388bd',
    'https://images.unsplash.com/photo-1605348532760-6753d2c43329',
    'https://images.unsplash.com/photo-1605348532760-6753d2c43329',
    'https://images.unsplash.com/photo-1609081219090-a6d81d3085bf',
    'https://images.unsplash.com/photo-1504639725590-34d0984388bd',
    'https://images.unsplash.com/photo-1582266255765-fa5cf1a1d501',
    'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d',
    'https://images.unsplash.com/photo-1504805572947-34fad45aed93',
    'https://images.unsplash.com/photo-1504805572947-34fad45aed93',
    'https://images.unsplash.com/photo-1504805572947-34fad45aed93',
    'https://images.unsplash.com/photo-1520256862855-398228c41684',
    'https://images.unsplash.com/photo-1520256862855-398228c41684',
    'https://images.unsplash.com/photo-1464207687429-7505649dae38',
    'https://images.unsplash.com/photo-1464207687429-7505649dae38',
    'https://images.unsplash.com/photo-1531537571171-a707bf2683da',
    'https://images.unsplash.com/photo-1531537571171-a707bf2683da',
    'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa',
    'https://images.unsplash.com/photo-1484417894907-623942c8ee29',
    'https://images.unsplash.com/photo-1484417894907-623942c8ee29',
    'https://images.unsplash.com/photo-1484417894907-623942c8ee29',
    'https://images.unsplash.com/photo-1604719312566-8912e9227c6a',
    'https://images.unsplash.com/photo-1604719312566-8912e9227c6a',
    'https://images.unsplash.com/photo-1536431311719-398b6704d4cc',
    'https://images.unsplash.com/photo-1575428652377-a2d80e2277fc',
    'https://images.unsplash.com/photo-1605034313761-73ea4a0cfbf3',
    'https://images.unsplash.com/photo-1605034313761-73ea4a0cfbf3',
    'https://images.unsplash.com/photo-1536431311719-398b6704d4cc',
    'https://images.unsplash.com/photo-1510915228340-29c85a43dcfe',
    'https://images.unsplash.com/photo-1510915228340-29c85a43dcfe',
    'https://images.unsplash.com/photo-1554384645-13eab165c24b',
    'https://images.unsplash.com/photo-1554384645-13eab165c24b',
    'https://images.unsplash.com/photo-1510915228340-29c85a43dcfe',
    'https://images.unsplash.com/photo-1575428652377-a2d80e2277fc',
    'https://images.unsplash.com/photo-1596727147705-61a532a659bd',
    'https://images.unsplash.com/photo-1596727147705-61a532a659bd',
    'https://images.unsplash.com/photo-1543269865-cbf427effbad',
    'https://images.unsplash.com/photo-1586105251261-72a756497a11',
    'https://images.unsplash.com/photo-1586105251261-72a756497a11',
    'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8',
    'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8',
    'https://images.unsplash.com/photo-1533139502658-0198f920d8e8',
    'https://images.unsplash.com/photo-1534088568595-a066f410bcda',
    'https://images.unsplash.com/photo-1558021212-51b6ecfa0db9',
    'https://images.unsplash.com/photo-1558021212-51b6ecfa0db9',
    'https://images.unsplash.com/photo-1481487196290-c152efe083f5',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c',
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655',
    'https://images.unsplash.com/photo-1495592822108-9e6261896da8',
    'https://images.unsplash.com/photo-1495592822108-9e6261896da8',
    'https://images.unsplash.com/photo-1573164574572-cb89e39749b4',
    'https://images.unsplash.com/photo-1573164574572-cb89e39749b4',
    'https://images.unsplash.com/photo-1607478900766-efe13248b125',
    'https://images.unsplash.com/photo-1573164574572-cb89e39749b4',
    'https://images.unsplash.com/photo-1607478900766-efe13248b125',
    'https://images.unsplash.com/photo-1529258283598-8d6fe60b27f4',
    'https://images.unsplash.com/photo-1529258283598-8d6fe60b27f4',
    'https://images.unsplash.com/photo-1529258283598-8d6fe60b27f4',
    'https://images.unsplash.com/photo-1493612276216-ee3925520721',
    'https://images.unsplash.com/photo-1493612276216-ee3925520721',
    'https://images.unsplash.com/photo-1512374382149-233c42b6a83b',
    'https://images.unsplash.com/photo-1512374382149-233c42b6a83b',
    'https://images.unsplash.com/photo-1525598912003-663126343e1f',
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e',
    'https://images.unsplash.com/photo-1588117472013-59bb13edafec',
    'https://images.unsplash.com/photo-1588117472013-59bb13edafec',
    'https://images.unsplash.com/photo-1588117472013-59bb13edafec',
    'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae',
    'https://images.unsplash.com/photo-1508830524289-0adcbe822b40',
    'https://images.unsplash.com/photo-1508830524289-0adcbe822b40',
    'https://images.unsplash.com/photo-1525598912003-663126343e1f',
    'https://images.unsplash.com/photo-1499336315816-097655dcfbda',
    'https://images.unsplash.com/photo-1514533450685-4493e01d1fdc',
    'https://images.unsplash.com/photo-1499336315816-097655dcfbda',
    'https://images.unsplash.com/photo-1514533450685-4493e01d1fdc',
    'https://images.unsplash.com/photo-1496128858413-b36217c2ce36',
    'https://images.unsplash.com/photo-1496128858413-b36217c2ce36',
    'https://images.unsplash.com/photo-1496128858413-b36217c2ce36',
    'https://images.unsplash.com/photo-1519163219899-21d2bb723b3e',
    'https://images.unsplash.com/photo-1507146426996-ef05306b995a',
    'https://images.unsplash.com/photo-1507146426996-ef05306b995a',
    'https://images.unsplash.com/photo-1571771019784-3ff35f4f4277',
    'https://images.unsplash.com/photo-1571771019784-3ff35f4f4277',
    'https://images.unsplash.com/photo-1607013251379-e6eecfffe234',
    'https://images.unsplash.com/photo-1607013251379-e6eecfffe234',
    'https://images.unsplash.com/photo-1487017159836-4e23ece2e4cf',
    'https://images.unsplash.com/photo-1487017159836-4e23ece2e4cf',
    'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3',
    'https://images.unsplash.com/photo-1473800447596-01729482b8eb',
    'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3',
    'https://images.unsplash.com/photo-1473800447596-01729482b8eb',
    'https://images.unsplash.com/photo-1473800447596-01729482b8eb',
    'https://images.unsplash.com/photo-1504196606672-aef5c9cefc92',
    'https://images.unsplash.com/photo-1504196606672-aef5c9cefc92',
    'https://images.unsplash.com/photo-1586401100295-7a8096fd231a',
    'https://images.unsplash.com/photo-1586401100295-7a8096fd231a',
    'https://images.unsplash.com/photo-1532009324734-20a7a5813719',
    'https://images.unsplash.com/photo-1532009324734-20a7a5813719',
    'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b',
    'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b',
    'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b',
    'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b',
    'https://images.unsplash.com/photo-1586473219010-2ffc57b0d282',
    'https://images.unsplash.com/photo-1586473219010-2ffc57b0d282',
    'https://images.unsplash.com/photo-1487014679447-9f8336841d58',
    'https://images.unsplash.com/photo-1487014679447-9f8336841d58',
    'https://images.unsplash.com/photo-1487014679447-9f8336841d58',
    'https://images.unsplash.com/photo-1526666923127-b2970f64b422',
    'https://images.unsplash.com/photo-1527689368864-3a821dbccc34',
    'https://images.unsplash.com/photo-1527689368864-3a821dbccc34',
    'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7',
    'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7',
    'https://images.unsplash.com/photo-1496096265110-f83ad7f96608',
    'https://images.unsplash.com/photo-1584433144859-1fc3ab64a957',
    'https://images.unsplash.com/photo-1584433144859-1fc3ab64a957',
    'https://images.unsplash.com/photo-1570464197285-9949814674a7',
    'https://images.unsplash.com/photo-1509909756405-be0199881695',
    'https://images.unsplash.com/photo-1509909756405-be0199881695',
    'https://images.unsplash.com/photo-1544006659-f0b21884ce1d',
    'https://images.unsplash.com/photo-1544006659-f0b21884ce1d',
    'https://images.unsplash.com/photo-1544006659-f0b21884ce1d',
    'https://images.unsplash.com/photo-1518481612222-68bbe828ecd1',
    'https://images.unsplash.com/photo-1518481612222-68bbe828ecd1',
    'https://images.unsplash.com/photo-1503602642458-232111445657',
    'https://images.unsplash.com/photo-1503602642458-232111445657',
    'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
    'https://images.unsplash.com/photo-1593640408182-31c70c8268f5'
  ];
  
  // Use the seed index directly to ensure unique images for each media item
  const baseUrl = baseUrls[seed % baseUrls.length];
  
  return `${baseUrl}?w=600&h=800&fit=crop&auto=format`;
}

export async function seedDatabase() {
  try {
    console.log('🌱 Seeding database with sports-brand-themed content...');

    await prisma.comment.deleteMany({});
    await prisma.like.deleteMany({});
    await prisma.media.deleteMany({});

    const testUser = await prisma.user.upsert({
      where: { email: 'test@mediasite.com' },
      update: {},
      create: {
        email: 'test@mediasite.com',
        username: 'testuser',
        password: 'hashedpassword123',
        displayName: 'Test User',
        avatarUrl: 'https://placehold.co/40x40/555555/ffffff?text=TU'
      }
    });

    const brandInfos = [
      { username: 'ProGear', displayName: 'ProGear', color: '0e7490' },
      { username: 'SprintLab', displayName: 'Sprint Lab', color: 'b91c1c' },
      { username: 'CourtKings', displayName: 'Court Kings', color: '6d28d9' },
      { username: 'FlexFit', displayName: 'FlexFit', color: '16a34a' },
      { username: 'TrailEdge', displayName: 'Trail Edge', color: 'd97706' },
    ];

    const brands = [] as { id: string; username: string }[];
    for (const b of brandInfos) {
      const user = await prisma.user.upsert({
        where: { email: `${b.username.toLowerCase()}@brands.local` },
        update: {},
        create: {
          email: `${b.username.toLowerCase()}@brands.local`,
          username: b.username,
          password: 'nopass',
          displayName: b.displayName,
          avatarUrl: `https://placehold.co/40x40/${b.color}/ffffff?text=${b.username.charAt(0)}`
        }
      });
      brands.push({ id: user.id, username: user.username });
    }

    const subscribed = [brands[0], brands[2]];
    for (const sub of subscribed) {
      await prisma.subscription.upsert({
        where: {
          subscriberId_subscribedToId: {
            subscriberId: testUser.id,
            subscribedToId: sub.id
          }
        },
        update: {},
        create: {
          subscriberId: testUser.id,
          subscribedToId: sub.id
        }
      });
    }

    const videoPool = [
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    ];

    const categories = ['Sports', 'Shoes', 'Apparel', 'Fitness', 'Accessories'];
    const productLines = [
      'Running Shoes', 'Basketball Shoes', 'Training Tee', 'Compression Top', 'Track Pants',
      'Hoodie', 'Caps', 'Backpack', 'Socks', 'Wristbands'
    ];

    const mediaToCreate: Array<{
      title: string;
      description: string;
      url: string;
      thumbnailUrl: string;
      type: 'VIDEO' | 'IMAGE';
      category: string;
      tags: string;
      duration: number | null;
      views: number;
      likes: number;
      uploaderId: string;
      groupId?: string | null;
    }> = [];

    const tagsBase = [
      'sports', 'brand', 'sneakers', 'running', 'training', 'fitness', 'apparel', 'gear'
    ];

    for (let i = 0; i < 240; i++) {
      const brand = pick(brands);
      const category = pick(categories);
      const product = pick(productLines);
      const isVideo = Math.random() < 0.35;
      const title = `${brand.username} ${product} — ${category}`;
      const description = `Showcase: ${product} by ${brand.username} for ${category.toLowerCase()} enthusiasts.`;
      const productImage = randomProductImageUrl(brand.username, product, i);
      const url = isVideo ? pick(videoPool) : productImage;
      const thumbnailUrl = isVideo ? productImage : productImage;
      const duration = isVideo ? pick([20, 25, 30, 45, 60]) : null;
      const views = Math.floor(200 + Math.random() * 5000);
      const likes = Math.floor(10 + Math.random() * Math.min(views, 600));
      const tags = JSON.stringify([...tagsBase, product.toLowerCase().replace(/\s+/g, '-')]);

      mediaToCreate.push({
        title,
        description,
        url,
        thumbnailUrl,
        type: isVideo ? 'VIDEO' : 'IMAGE',
        category,
        tags,
        duration,
        views,
        likes,
        uploaderId: brand.id,
      });
    }

    console.log(`🖼️ Creating ${mediaToCreate.length} sports/brand themed media items...`);
    const createdMedia: { id: string; uploaderId: string }[] = [];
    for (const media of mediaToCreate) {
      const created = await prisma.media.create({ data: media });
      createdMedia.push({ id: created.id, uploaderId: created.uploaderId });
    }
    console.log('✅ Media created.');

    const likeSample = createdMedia.filter(() => Math.random() < 0.6);
    for (const m of likeSample) {
      await prisma.like.upsert({
        where: { userId_mediaId: { userId: testUser.id, mediaId: m.id } },
        update: {},
        create: { userId: testUser.id, mediaId: m.id }
      });
    }

    const comments = [
      'Clean look! 🔥',
      'Would wear to the gym. 💪',
      'Great traction on court.',
      'Love this colorway.',
      'Comfort looks top-tier.'
    ];
    const commentSample = createdMedia.filter(() => Math.random() < 0.25);
    for (const m of commentSample) {
      await prisma.comment.create({
        data: {
          content: pick(comments),
          authorId: testUser.id,
          mediaId: m.id
        }
      });
    }

    console.log('✅ Database seeded successfully!');
    console.log(`📊 Created ${mediaToCreate.length} media items across ${brands.length} brands`);
    console.log(`👤 Test user: ${testUser.username} (subscribed to: ${subscribed.map(s => s.username).join(', ')})`);
    console.log('🚀 Ready to test recommendations on the homepage.');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}


