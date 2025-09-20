const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function checkOrg() {
  try {
    const org = await prisma.org.findUnique({
      where: { id: "yardura" },
    });
    console.log("Yardura org:", org);

    const leads = await prisma.lead.findMany({
      take: 5,
      orderBy: { submittedAt: "desc" },
    });
    console.log("Recent leads:", leads.length);
    console.log(
      "Lead orgIds:",
      leads.map((l) => l.orgId),
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrg();
