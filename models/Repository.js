import {DataTypes} from "sequelize";
import {sequelize} from "./Database.js";
import {Run} from "./Run.js";

export const Repository = sequelize.define('Repository', {
    id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    run_id: {
        type: DataTypes.UUID,
        references: {
            model: Run,
            key: 'id'
        }
    },
    origin: {
        type: DataTypes.STRING,
        allowNull: false
    },
    commit: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    started: {
        type: DataTypes.DATE,
        default: DataTypes.NOW
    },
    finished: {
        type: DataTypes.DATE
    },
    status: {
        type: DataTypes.ENUM('success', 'failed')
    }
});
