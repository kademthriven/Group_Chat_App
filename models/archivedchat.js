"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ArchivedChat extends Model {
    static associate(models) {
      ArchivedChat.belongsTo(models.User, {
        foreignKey: "userId",
        as: "sender"
      });
    }
  }

  ArchivedChat.init(
    {
      originalMessageId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      archivedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: "ArchivedChat"
    }
  );

  return ArchivedChat;
};
