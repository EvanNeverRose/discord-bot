require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField
} = require("discord.js");

const fs = require("fs");

const dbFile = "./database.json";

/* ================= SAFE DATABASE ================= */

function loadDB() {
  const defaultDB = {
    orderCounter: 1,
    activeOrders: {},
    completedOrders: {},
    sellers: {},
    netWorth: 0,
    autoRole: null,
    logChannel: null
  };

  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify(defaultDB, null, 2));
    return defaultDB;
  }

  try {
    const data = JSON.parse(fs.readFileSync(dbFile));
    return data;
  } catch {
    fs.writeFileSync(dbFile, JSON.stringify(defaultDB, null, 2));
    return defaultDB;
  }
}

function saveDB(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

/* ================= CLIENT ================= */

if (!process.env.BOT_TOKEN) {
  console.error("BOT_TOKEN missing.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

/* ================= EMBED BUILDER ================= */

function buildOrderEmbed(id, order) {
  const subtotal = order.items.reduce((a, b) => a + b.price, 0);
  const taxed = Math.ceil(subtotal / 0.7);

  return new EmbedBuilder()
    .setTitle(`🛒 Order #${id}`)
    .setDescription(
      order.items.length === 0
        ? "No items yet."
        : order.items.map((item, i) =>
            `**${i + 1}.** ${item.type}${item.name ? ` - ${item.name}` : ""} | ${item.price} R$ | ${item.completed ? "✅" : "❌"}`
          ).join("\n")
    )
    .addFields(
      { name: "Subtotal", value: `${subtotal} R$` },
      { name: "Including Roblox Tax (30%)", value: `${taxed} R$` }
    )
    .setColor(0x2b2d31)
    .setTimestamp();
}

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/* ================= AUTO ROLE ================= */

client.on("guildMemberAdd", member => {
  const db = loadDB();
  if (!db.autoRole) return;

  const role = member.guild.roles.cache.get(db.autoRole);
  if (role) member.roles.add(role).catch(() => {});
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async interaction => {
  const db = loadDB();

/* ---------- SLASH COMMANDS ---------- */

if (interaction.isChatInputCommand()) {

  if (interaction.commandName === "create_order") {

    const id = db.orderCounter++;
    db.activeOrders[id] = { seller: interaction.user.id, items: [] };
    saveDB(db);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`add_${id}`).setLabel("➕ Add Item").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`remove_${id}`).setLabel("🗑 Remove Item").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`complete_${id}`).setLabel("✅ Mark Complete").setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`finish_${id}`).setLabel("🏁 Finish Order").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`void_${id}`).setLabel("❌ Void Order").setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({
      embeds: [buildOrderEmbed(id, db.activeOrders[id])],
      components: [row1, row2]
    });
  }

  if (interaction.commandName === "networth")
    return interaction.reply(`💰 Networth: ${db.netWorth} R$`);

}

/* ---------- BUTTONS ---------- */

if (interaction.isButton()) {

  const [action, id] = interaction.customId.split("_");
  const order = db.activeOrders[id];

  if (!order)
    return interaction.reply({ content: "Order not found.", ephemeral: true });

  if (action === "void") {
    delete db.activeOrders[id];
    saveDB(db);

    return interaction.update({
      content: "❌ Order voided.",
      embeds: [],
      components: []
    });
  }

  if (action === "finish") {

    const subtotal = order.items.reduce((a, b) => a + b.price, 0);
    const taxed = Math.ceil(subtotal / 0.7);

    db.netWorth += taxed;
    db.sellers[order.seller] =
      (db.sellers[order.seller] || 0) + taxed;

    db.completedOrders[id] = order;
    delete db.activeOrders[id];

    saveDB(db);

    return interaction.update({
      content: "✅ Order finished.",
      embeds: [],
      components: []
    });
  }
}

/* ---------- SELECT + MODALS ---------- */

if (interaction.isStringSelectMenu()) {

  const [prefix, id] = interaction.customId.split("_");
  if (prefix !== "type") return;

  const type = interaction.values[0];

  const modal = new ModalBuilder()
    .setCustomId(`add_modal_${id}_${type}`)
    .setTitle(`Add ${type}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("price")
        .setLabel("Price")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("name")
        .setLabel("Product Name (optional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    )
  );

  return interaction.showModal(modal);
}

/* ---------- MODAL SUBMIT ---------- */

if (interaction.isModalSubmit()) {

  const parts = interaction.customId.split("_");

  if (parts[0] === "add") {

    const id = parts[2];
    const type = parts[3];

    const db = loadDB();
    const order = db.activeOrders[id];
    if (!order) return;

    const price = parseInt(interaction.fields.getTextInputValue("price"));
    const name = interaction.fields.getTextInputValue("name");

    order.items.push({
      type,
      name: name || null,
      price,
      completed: false
    });

    saveDB(db);

    return interaction.reply({
      content: "Item added.",
      embeds: [buildOrderEmbed(id, order)],
      ephemeral: true
    });
  }
}

});

/* ================= LOGIN ================= */

client.login(process.env.BOT_TOKEN);
