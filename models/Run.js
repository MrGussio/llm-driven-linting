import {DataTypes} from "sequelize";
import {sequelize} from "./Database.js";

export const Run = sequelize.define('Run', {
    id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    started: {
        type:DataTypes.DATE,
        default: DataTypes.NOW,
    },
    finished: {
        type: DataTypes.DATE,
        default: null
    }
})
