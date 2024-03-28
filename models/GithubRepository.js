import {sequelize} from "./Database.js";
import {DataTypes} from "sequelize";

export const GithubRepository = sequelize.define('GithubRepository', {
    org: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    repo: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    commit: {
        type: DataTypes.STRING
    },
    stars: {
        type: DataTypes.INTEGER
    },
    forks: {
        type: DataTypes.INTEGER
    },
    watchers: {
        type: DataTypes.INTEGER
    },
    size: {
        type: DataTypes.INTEGER
    },
    commits: {
        type: DataTypes.INTEGER
    }
});
