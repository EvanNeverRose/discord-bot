require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

/* ================= ENVIRONMENT CHECK ================= */

if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is missing from environment variables.");
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error("❌ CLIENT_ID is missing from environment variables.");
  process.exit(1);
}

if (!process.env.GUILD_ID) {
  console.error("❌ GUILD_ID is missing from environment variables.");
  process.exit(1);
}

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

/* ================= COMMANDS ================= */

const commands = [

  new SlashCommandBuilder()
    .setName("create_order")
    .setDescription("Create a new order"),

  new SlashCommandBuilder()
    .setName("void_order")
    .setDescription("Void an order")
    .addIntegerOption(option =>
      option.setName("id")
        .setDescription("Order ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("order_details")
    .setDescription("View order details")
    .addIntegerOption(option =>
      option.setName("id")
        .setDescription("Order ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("sellers")
    .setDescription("View seller leaderboard"),

  new SlashCommandBuilder()
    .setName("sellers_edit")
    .setDescription("Add or remove seller profit")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("Seller")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("amount")
        .setDescription("Amount to add/remove (use negative to subtract)")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("networth")
    .setDescription("View server net worth"),

  new SlashCommandBuilder()
    .setName("sellinglogs")
    .setDescription("Set the selling logs channel")
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Channel for sale logs")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Set auto role for new members")
    .addRoleOption(option =>
      option.setName("role")
        .setDescription("Role to give on join")
        .setRequired(true)
    )

].map(command => command.toJSON());

/* ================= DEPLOY ================= */

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("🚀 Deploying slash commands...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ Slash commands deployed successfully.");
  } catch (error) {
    console.error("❌ Failed to deploy commands:");
    console.error(error);
  }
})();