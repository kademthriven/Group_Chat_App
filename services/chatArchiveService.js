const { Op } = require("sequelize");

function createChatArchiveService({ sequelize, Message, ArchivedChat, logger = console }) {
  async function archiveOldMessages() {
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
