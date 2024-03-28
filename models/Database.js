import {Sequelize} from "sequelize";

export const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "./dataset.db",
    logging: false
});
