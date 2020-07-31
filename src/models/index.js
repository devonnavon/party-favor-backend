import Sequelize, { DataTypes } from 'sequelize';
import user from './user';
import message from './message';
import landingText from './landingText';

const sequelize = new Sequelize(
	process.env.TEST_DATABASE || process.env.DATABASE,
	process.env.DATABASE_USER,
	process.env.DATABASE_PASSWORD,
	{
		dialect: 'postgres',
		operatorsAliases: false,
	}
);

const models = {
	User: user(sequelize, DataTypes),
	Message: message(sequelize, DataTypes),
	LandingText: landingText(sequelize, DataTypes),
};

Object.keys(models).forEach((key) => {
	if ('associate' in models[key]) {
		models[key].associate(models);
	}
});

export { sequelize };
export const Op = Sequelize.Op;

export default models;
