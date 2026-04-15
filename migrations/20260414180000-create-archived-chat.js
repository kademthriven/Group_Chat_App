"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ArchivedChats", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      originalMessageId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      archivedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addIndex("Messages", ["createdAt"], {
      name: "messages_created_at_idx"
    });

    await queryInterface.addIndex("ArchivedChats", ["archivedAt"], {
      name: "archived_chats_archived_at_idx"
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ArchivedChats", "archived_chats_archived_at_idx");
    await queryInterface.removeIndex("Messages", "messages_created_at_idx");
    await queryInterface.dropTable("ArchivedChats");
  }
};
