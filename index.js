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

if (!process.env.BOT_TOKEN) {
  console.error("BOT_TOKEN missing.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

/* ================= DATABASE ================= */

function loadDB() {
  return JSON.parse(fs.readFileSync(dbFile));
}

function saveDB(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

/* ================= EMBED ================= */

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

/* ================= SLASH COMMANDS ================= */

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

  if (interaction.commandName === "order_details") {
    const id = interaction.options.getInteger("id");
    const order = db.activeOrders[id] || db.completedOrders[id];
    if (!order)
      return interaction.reply({ content: "Order not found.", ephemeral: true });

    return interaction.reply({ embeds: [buildOrderEmbed(id, order)] });
  }

  if (interaction.commandName === "void_order") {
    const id = interaction.options.getInteger("id");
    if (!db.activeOrders[id])
      return interaction.reply({ content: "Order not found.", ephemeral: true });

    delete db.activeOrders[id];
    saveDB(db);
    return interaction.reply(`Order #${id} voided.`);
  }

  if (interaction.commandName === "sellers") {
    const sorted = Object.entries(db.sellers)
      .sort((a, b) => b[1] - a[1])
      .map(([id, amount], i) =>
        `**${i + 1}.** <@${id}> — ${amount} R$`
      ).join("\n") || "No sellers yet.";

    return interaction.reply({ embeds: [new EmbedBuilder().setTitle("🏆 Seller Leaderboard").setDescription(sorted)] });
  }

  if (interaction.commandName === "sellers_edit") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: "Admin only.", ephemeral: true });

    const user = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    db.sellers[user.id] = (db.sellers[user.id] || 0) + amount;
    saveDB(db);

    return interaction.reply("Seller updated.");
  }

  if (interaction.commandName === "networth")
    return interaction.reply(`💰 Networth: ${db.netWorth} R$`);

  if (interaction.commandName === "sellinglogs") {
    db.logChannel = interaction.options.getChannel("channel").id;
    saveDB(db);
    return interaction.reply("Selling log channel set.");
  }

  if (interaction.commandName === "autorole") {
    db.autoRole = interaction.options.getRole("role").id;
    saveDB(db);
    return interaction.reply("Auto role set.");
  }
}

/* ================= BUTTONS ================= */

if (interaction.isButton()) {

  const [action, id] = interaction.customId.split("_");
  const order = db.activeOrders[id];

  if (!order)
    return interaction.reply({ content: "Order not found.", ephemeral: true });

  if (action === "add") {

    const select = new StringSelectMenuBuilder()
      .setCustomId(`type_${id}`)
      .setPlaceholder("Select item type")
      .addOptions([
        { label: "Livery", value: "Livery" },
        { label: "Uniform", value: "Uniform" },
        { label: "ELS", value: "ELS" },
        { label: "Logo", value: "Logo" }
      ]);

    return interaction.reply({
      content: "Choose item type:",
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
  }

  if (action === "remove") {
    const modal = new ModalBuilder()
      .setCustomId(`remove_modal_${id}`)
      .setTitle("Remove Item");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("itemNumber")
          .setLabel("Item Number")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  if (action === "complete") {
    const modal = new ModalBuilder()
      .setCustomId(`complete_modal_${id}`)
      .setTitle("Mark Item Complete");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("itemNumber")
          .setLabel("Item Number")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
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

    if (db.logChannel) {
      const channel = interaction.guild.channels.cache.get(db.logChannel);
      if (channel)
        channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`Sale Completed - Order #${id}`)
              .setDescription(`Seller: <@${order.seller}>\nEarned: ${taxed} R$`)
              .addFields({ name: "Items", value: order.items.map(i => `${i.type} - ${i.price} R$`).join("\n") })
          ]
        });
    }

    return interaction.update({
      content: "✅ Order finished.",
      embeds: [],
      components: []
    });
  }

  if (action === "void") {
    delete db.activeOrders[id];
    saveDB(db);
    return interaction.update({ content: "❌ Order voided.", embeds: [], components: [] });
  }
}

/* ================= SELECT MENU ================= */

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

/* ================= MODALS ================= */

if (interaction.isModalSubmit()) {

  const parts = interaction.customId.split("_");

  if (parts[0] === "add") {
    const id = parts[2];
    const type = parts[3];
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

  if (parts[0] === "remove") {
    const id = parts[2];
    const order = db.activeOrders[id];
    const num = parseInt(interaction.fields.getTextInputValue("itemNumber"));

    if (!order || !order.items[num - 1])
      return interaction.reply({ content: "Invalid item.", ephemeral: true });

    order.items.splice(num - 1, 1);
    saveDB(db);

    return interaction.reply({
      content: "Item removed.",
      embeds: [buildOrderEmbed(id, order)],
      ephemeral: true
    });
  }

  if (parts[0] === "complete") {
    const id = parts[2];
    const order = db.activeOrders[id];
    const num = parseInt(interaction.fields.getTextInputValue("itemNumber"));

    if (!order || !order.items[num - 1])
      return interaction.reply({ content: "Invalid item.", ephemeral: true });

    order.items[num - 1].completed = true;
    saveDB(db);

    return interaction.reply({
      content: "Item marked complete.",
      embeds: [buildOrderEmbed(id, order)],
      ephemeral: true
    });
  }
}

});

client.login(process.env.BOT_TOKEN);