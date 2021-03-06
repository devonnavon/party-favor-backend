import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import DataLoader from 'dataloader';
import { ApolloServer, AuthenticationError } from 'apollo-server-express';
import http from 'http'; //for subscription setup
import AWS from 'aws-sdk';

import schema from './schema';
import resolvers from './resolvers';
import models, { sequelize } from './models';
import seed from './models/seed';
import loaders from './loaders';

const app = express();

app.use(cors());

const s3 = new AWS.S3({
	apiVersion: '2006-03-01',
	signatureVersion: 'v4',
	region: 'us-west-1',
});

const getMe = async (req) => {
	const token = req.headers['x-token'];

	if (token) {
		try {
			return await jwt.verify(token, process.env.SECRET);
		} catch (e) {
			throw new AuthenticationError('Your session expired. Sign in again.');
		}
	}
};

const server = new ApolloServer({
	introspection: true,
	playground: true,
	typeDefs: schema,
	resolvers,
	formatError: (error) => {
		// remove the internal sequelize error message
		// leave only the important validation error
		const message = error.message
			.replace('SequelizeValidationError: ', '')
			.replace('Validation error: ', '');

		return {
			...error,
			message,
		};
	},
	context: async ({ req, connection }) => {
		if (connection) {
			return {
				models,
				loaders: {
					user: new DataLoader((keys) => loaders.user.batchUsers(keys, models)),
				},
			};
		}

		if (req) {
			const me = await getMe(req);
			return {
				models,
				sequelize,
				me,
				s3,
				secret: process.env.SECRET,
				loaders: {
					user: new DataLoader((keys) => loaders.user.batchUsers(keys, models)),
				},
			};
		}
	},
});

server.applyMiddleware({ app, path: '/api' });

const httpServer = http.createServer(app);
server.installSubscriptionHandlers(httpServer);

const port = process.env.PORT || 8000;
const eraseDatabaseOnSync = !process.env.DATABASE_URL; //only erase in dev, not in prd
const isTest = !!process.env.TEST_DATABASE;

sequelize.sync({ force: isTest || eraseDatabaseOnSync }).then(async () => {
	if (isTest || eraseDatabaseOnSync) {
		seed.createUsersWithMessages(new Date());
	}
	seed.createLandingPageContent();

	httpServer.listen(port, () =>
		console.log(`Example app listening on port ${port}!`)
	);
});
