import {sequelize} from "./Database.js";
import {DataTypes} from "sequelize";
import {LintError} from "./LintError.js";

export const TestResult = sequelize.define('TestResult', {
    id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    lint_error_id: {
        type: DataTypes.UUID,
        references: {
            model: LintError,
            key: 'id'
        }
    },
    before_context: {
        type: DataTypes.STRING
    },
    after_context: {
        type: DataTypes.STRING
    },
    prompt: {
        type: DataTypes.STRING
    },
    context_size: {
        type: DataTypes.INTEGER
    },
    classification: {
        type: DataTypes.ENUM('SUCCESS', 'STALE', 'WORSENED', 'SYNTAX', 'UNCLASSIFIED'),
        defaultValue: null
    },
    new_classification: {
        type: DataTypes.STRING,
        defaultValue: null
    }
});
