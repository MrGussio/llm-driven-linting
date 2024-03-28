import {DataTypes} from "sequelize";
import {Repository} from "./Repository.js";
import {sequelize} from "./Database.js";

export const LintError = sequelize.define('LintError', {
    id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    repository_id: {
        type: DataTypes.UUID,
        references: {
            model: Repository,
            key: 'id'
        }
    },
    file: {
        type: DataTypes.STRING,
        // allowNull: false
    },
    line: {
        type: DataTypes.NUMBER,
        // allowNull: false
    },
    column: {
        type: DataTypes.NUMBER,
        // allowNull: false
    },
    error: {
        type: DataTypes.STRING,
        // allowNull: false,
    },
    message: {
        type: DataTypes.STRING,
        // allowNull: false
    }
});
