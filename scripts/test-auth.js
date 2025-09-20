const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function testAuth() {
  try {
    console.log("Testing authentication for ayden@yardura.com...");

    const user = await prisma.user.findUnique({
      where: { email: "ayden@yardura.com" },
      include: { accounts: true },
    });

    if (!user) {
      console.log("❌ User not found");
      return;
    }

    console.log("✅ User found:", user.email, user.role);

    // Find credentials account
    const credentialsAccount = user.accounts.find(
      (account) => account.provider === "credentials",
    );

    if (!credentialsAccount) {
      console.log("❌ No credentials account found");
      return;
    }

    console.log("✅ Credentials account found");

    if (!credentialsAccount.access_token) {
      console.log("❌ No password hash found");
      return;
    }

    console.log("✅ Password hash exists");

    // Test password verification
    const testPassword = "G00g00gaj00b^^";
    const isValid = await bcrypt.compare(
      testPassword,
      credentialsAccount.access_token,
    );

    console.log(
      "Password verification result:",
      isValid ? "✅ SUCCESS" : "❌ FAILED",
    );

    if (isValid) {
      console.log("🎉 Authentication should work!");
    } else {
      console.log("🔍 Let me check what the stored hash looks like...");
      console.log("Hash length:", credentialsAccount.access_token.length);
      console.log(
        "Hash starts with:",
        credentialsAccount.access_token.substring(0, 10) + "...",
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuth();
