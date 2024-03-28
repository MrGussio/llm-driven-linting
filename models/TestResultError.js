import {sequelize} from "./Database.js";
import {DataTypes} from "sequelize";
import {TestResult} from "./TestResult.js";

export const TestResultError = sequelize.define('TestResultError', {
    id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    test_result_id: {
        type: DataTypes.UUID,
        references: {
            model: TestResult,
            key: 'id'
        }
    },
    state: {
        type: DataTypes.ENUM('before', 'after')
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
