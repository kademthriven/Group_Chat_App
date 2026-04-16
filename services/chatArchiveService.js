const { Op } = require("sequelize");

function createChatArchiveService({ sequelize, Message, ArchivedChat, logger = console }) {
  async function archivedChatTableExists() {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();

    return tables
      .map((tableName) => {
        if (typeof tableName === "string") {
          return tableName;
        }

        return tableName?.tableName || tableName?.name || "";
      })
      .some((tableName) => String(tableName).toLowerCase() === "archivedchats");
  }

  async function archiveOldMessages() {
    const hasArchiveTable = await archivedChatTableExists();

    if (!hasArchiveTable) {
      logger.warn("Skipping nightly archive because the ArchivedChats table does not exist yet. Run the database migration first.");
      return {
        archivedCount: 0,
        skipped: true
      };
    }

    const cutoff = new Date(Date.now() - (24 * 60 * 60 * 1000));

    return sequelize.transaction(async (transaction) => {
      const staleMessages = await Message.findAll({
        where: {
          createdAt: {
            [Op.lt]: cutoff
          }
        },
        order: [["createdAt", "ASC"]],
        transaction
      });

      if (staleMessages.length === 0) {
        return {
          archivedCount: 0
        };
      }

      await ArchivedChat.bulkCreate(
        staleMessages.map((message) => ({
          originalMessageId: message.id,
          userId: message.userId,
          message: message.message,
          archivedAt: new Date(),
          createdAt: message.createdAt,
          updatedAt: message.updatedAt
        })),
        {
          transaction
        }
      );

      await Message.destroy({
        where: {
          id: staleMessages.map((message) => message.id)
        },
        transaction
      });

      return {
        archivedCount: staleMessages.length
      };
    });
  }

  return {
    archiveOldMessages
  };
}

module.exports = createChatArchiveService;
