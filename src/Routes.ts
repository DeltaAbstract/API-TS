import { Router } from 'express';
import BaseObj from './Structures/BaseObj';
import Functions from './Functions/Functions';
import { Pool } from 'pg';
import rateLimit from 'express-rate-limit';
import path from 'path';

const Client = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: { rejectUnauthorized: false },
});

const router = Router();

const { Funcs, Verifier, Utils, Success } = Functions;

router.use((req, res, next) => {
	next();
});

router.get('/test', (req, res) => {
	const options = {
		root: path.join(__dirname, ''),
		dotfiles: 'deny',
		headers: {
			'x-timestamp': Date.now(),
			'x-sent': true,
		},
	};

	return res.status(200).sendFile('./index.html', options);
});

router.get('/ip', (req, res) => {
	return res
		.status(200)
		.redirect(
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ&ab_channel=RickAstley'
		);
});

router.get('/', (req, res) => {
	const data = {
		docs: 'https://processversion.herokuapp.com/docs',
		endpoints: `https://processversion.herokuapp.com/endpoints`,
	};

	return new Success(res).SetData(data).Respond();
});

router.get('/docs', (req, res) => {
	return res
		.status(200)
		.redirect(`https://github.com/ProcessVersion/processversion-api#readme`);
});

router.get('/endpoints', (req, res) => {
	return res.status(200).json([
		{
			path: '/reddit',
			methods: ['GET'],
		},
		{
			path: '/subreddit',
			methods: ['GET'],
		},
		{
			path: '/roblox',
			methods: ['GET'],
		},
		{
			path: '/discord',
			methods: ['GET'],
		},
		{
			path: '/user',
			methods: ['GET', 'PATCH', 'PUT', 'DELETE'],
		},
	]);
});

router.get(`/roblox/`, async (req, res) => {
	const client = await Client.connect();
	const key = req.headers.authorization || req.query?.key;

	try {
		if (key == undefined) {
			return new Functions.InvalidKey(res).Respond();
		}

		const hmac = new Utils().ConvertKey(key as string);

		const request = await client.query(
			`SELECT ips FROM ApiUser WHERE apikey = '${hmac}'`
		);

		if (request.rows.length == 0) {
			return new Functions.InvalidKey(res).Respond();
		}

		if (request.rows[0].ips == null || request.rows[0].ips == 'null') {
			const iphmac = new Utils().ConvertIP(req.ip);
			
			new Utils().SetIP(client, iphmac)
		}

		const ip = request.rows.length > 0 ? request.rows[0].ips : req.ip;

		const verifier = new Verifier(key as string, ip, false);

		const isEqual = verifier.CheckIP(req.ip);

		if (!isEqual) {
			return new Functions.InvalidIP(res).Respond();
		}

		if (!req.query.username) {
			return new Functions.BadRequest(res)
				.SetStatus(400, 'Missing text query')
				.Respond();
		}

		const username = req.query.username as string;

		const { Roblox } = new Funcs();

		return res.json(await Roblox(username));
	} catch (error) {
		console.log(error);

		return res.status(500).json(
			new BaseObj({
				success: false,
				status: 500,
				statusMessage: 'An unexpected error has occurred',
				data: null,
			})
		);
	} finally {
		const hmac = new Utils().ConvertKey(key as string);

		const result = await client.query(
			`SELECT timesused FROM ApiUser WHERE apikey = '${hmac}'`
		);

		if (result.rows.length == 0) {
			return client.release();
		}

		let times = parseInt(result.rows[0].timesused);
		times++;

		await client.query(`BEGIN`);
		await client.query(
			`UPDATE ApiUser SET timesused = '${times}' WHERE apikey = '${hmac}'`
		);
		await client.query(`COMMIT`);

		client.release();
	}
});

router.get('/subreddit/', async (req, res) => {
	const client = await Client.connect();
	const key = req.headers.authorization || req.query?.key;

	try {
		if (key == undefined) {
			return res.status(401).json(
				new BaseObj({
					success: false,
					status: 401,
					statusMessage: 'You must include an API key',
					data: null,
				})
			);
		}

		const hmac = new Utils().ConvertKey(key as string);

		const request = await client.query(
			`SELECT ips FROM ApiUser WHERE apikey = '${hmac}'`
		);

		if (request.rows.length == 0) {
			return res.status(403).json(
				new BaseObj({
					success: false,
					status: 403,
					statusMessage: "I couldn't find this key in my database!",
					data: null,
				})
			);
		}

		if (request.rows[0].ips == null || request.rows[0].ips == 'null') {
			const iphmac = new Utils().ConvertIP(req.ip);

			await client.query(`BEGIN`);
			await client.query(
				`UPDATE ApiUser SET ips = '${iphmac}' WHERE apikey = '${hmac}'`
			);
			await client.query(`COMMIT`);
		}

		const ip = request.rows.length > 0 ? request.rows[0].ips : req.ip;

		const verifier = new Verifier(key as string, ip, false);

		const isEqual = verifier.CheckIP(req.ip);

		if (!isEqual) {
			return res.status(403).json(
				new BaseObj({
					success: false,
					status: 403,
					statusMessage:
						'Invalid IP address. API key must be used at original IP address',
					data: null,
				})
			);
		}

		if (!req.query.subreddit) {
			return res.status(400).json(
				new BaseObj({
					success: false,
					status: 400,
					statusMessage: 'Missing subreddit query',
					data: null,
				})
			);
		}

		const subreddit = req.query.subreddit as string;

		const { Subreddit } = new Funcs();
		return res.json(await Subreddit(subreddit));
	} catch (error) {
		console.log(error);

		return res.status(500).json(
			new BaseObj({
				success: false,
				status: 500,
				statusMessage: 'An unexpected error has occured',
				data: null,
			})
		);
	} finally {
		const hmac = new Utils().ConvertKey(key as string);

		const result = await client.query(
			`SELECT timesused FROM ApiUser WHERE apikey = '${hmac}'`
		);

		if (result.rows.length == 0) {
			return client.release();
		}

		let times = parseInt(result.rows[0].timesused);
		times++;

		await client.query(`BEGIN`);
		await client.query(
			`UPDATE ApiUser SET timesused = '${times}' WHERE apikey = '${hmac}'`
		);
		await client.query(`COMMIT`);

		client.release();
	}
});

router.get('/reddit/', async (req, res) => {
	const client = await Client.connect();
	const key = req.headers.authorization || req.query?.key;

	try {
		if (key == undefined) {
			return res.status(401).json(
				new BaseObj({
					success: false,
					status: 401,
					statusMessage: 'You must include an API key',
					data: null,
				})
			);
		}

		const hmac = new Utils().ConvertKey(key as string);

		const request = await client.query(
			`SELECT ips FROM ApiUser WHERE apikey = '${hmac}'`
		);

		if (request.rows.length == 0) {
			return res.status(403).json(
				new BaseObj({
					success: false,
					status: 403,
					statusMessage: "I couldn't find this key in my database!",
					data: null,
				})
			);
		}

		let ip: string;

		if (request.rows.length > 0 && request.rows[0].ips != null) {
			ip = request.rows[0].ips;
		}

		if (request.rows[0].ips == null || request.rows[0].ips == 'null') {
			const iphmac = new Utils().ConvertIP(req.ip);

			await client.query(`BEGIN`);
			await client.query(
				`UPDATE ApiUser SET ips = '${iphmac}' WHERE apikey = '${hmac}'`
			);
			await client.query(`COMMIT`);

			ip = iphmac;
		}

		const verifier = new Verifier(key as string, ip, false);

		const isEqual = verifier.CheckIP(req.ip);

		if (!isEqual) {
			return res.status(403).json(
				new BaseObj({
					success: false,
					status: 403,
					statusMessage:
						'Invalid IP address. API key must be used at original IP address',
					data: null,
				})
			);
		}

		if (!req.query.user) {
			return res.status(400).json(
				new BaseObj({
					success: false,
					status: 400,
					statusMessage: 'Missing user query',
					data: null,
				})
			);
		}

		const user = req.query.user as string;

		const { User } = new Funcs();
		return res.json(await User(user));
	} catch (error) {
		console.log(error);

		return res.status(500).json(
			new BaseObj({
				success: false,
				status: 500,
				statusMessage: 'An unexpected error has occured',
				data: null,
			})
		);
	} finally {
		const hmac = new Utils().ConvertKey(key as string);

		const result = await client.query(
			`SELECT timesused FROM ApiUser WHERE apikey = '${hmac}'`
		);

		if (result.rows.length == 0) {
			return client.release();
		}

		let times = parseInt(result.rows[0].timesused);
		times++;

		await client.query(`BEGIN`);
		await client.query(
			`UPDATE ApiUser SET timesused = '${times}' WHERE apikey = '${hmac}'`
		);
		await client.query(`COMMIT`);

		client.release();
	}
});

router.get('/reverse/', async (req, res) => {
	const client = await Client.connect();

	const key = req.headers.authorization || req.query?.key;

	try {
		if (key == undefined) {
			return res.status(401).json(
				new BaseObj({
					success: false,
					status: 401,
					statusMessage: 'You must include an API key',
					data: null,
				})
			);
		}

		const hmac = new Utils().ConvertKey(key as string);

		const request = await client.query(
			`SELECT ips FROM ApiUser WHERE apikey = '${hmac}'`
		);

		if (request.rows.length == 0) {
			return res.status(403).json(
				new BaseObj({
					success: false,
					status: 403,
					statusMessage: "I couldn't find this key in my database!",
					data: null,
				})
			);
		}

		if (request.rows[0].ips == null || request.rows[0].ips == 'null') {
			const iphmac = new Utils().ConvertIP(req.ip);

			await client.query(`BEGIN`);
			await client.query(
				`UPDATE ApiUser SET ips = '${iphmac}' WHERE apikey = '${hmac}'`
			);
			await client.query(`COMMIT`);
		}

		const ip = request.rows.length > 0 ? request.rows[0].ips : req.ip;

		const verifier = new Verifier(key as string, ip, false);

		const isEqual = verifier.CheckIP(req.ip);

		if (!isEqual) {
			return res.status(403).json(
				new BaseObj({
					success: false,
					status: 403,
					statusMessage:
						'Invalid IP address. API key must be used at original IP address',
					data: null,
				})
			);
		}

		if (!req.query.text) {
			return res.status(400).json(
				new BaseObj({
					success: false,
					status: 400,
					statusMessage: 'Missing text query',
					data: null,
				})
			);
		}

		return res.status(200).json(
			new BaseObj({
				success: true,
				status: 200,
				statusMessage: 'OK',
				data: { text: new Funcs().reverse(req.query.text) },
			})
		);
	} catch (error) {
		console.log(error);

		return res.status(500).json(
			new BaseObj({
				success: false,
				status: 500,
				statusMessage: 'An unexpected error has occurred',
				data: null,
			})
		);
	} finally {
		const newKey = new Utils().ConvertKey(key as string);

		const result = await client.query(
			`SELECT timesused FROM ApiUser WHERE apikey = '${newKey}'`
		);

		if (result.rows.length == 0) return client.release();

		let times = parseInt(result.rows[0].timesused);
		times++;

		await client.query(`BEGIN`);
		await client.query(
			`UPDATE ApiUser SET timesused = '${times}' WHERE apikey = '${newKey}'`
		);
		await client.query(`COMMIT`);

		return client.release();
	}
});

router.get('/user/', async (req, res) => {
	const key = req.headers.authorization || req.query?.key;
	const client = await Client.connect();
	try {
		if (key == undefined) {
			return res.status(401).json(
				new BaseObj({
					success: false,
					status: 401,
					statusMessage: 'Missing token through authorization or query',
					data: null,
				})
			);
		}

		if (key != process.env.OWNER_KEY) {
			return res.status(403).json(
				new BaseObj({
					success: false,
					status: 403,
					statusMessage: 'This is an owner only route',
					data: null,
				})
			);
		}
		if (!req.query.id) {
			return res.status(400).json(
				new BaseObj({
					success: false,
					status: 400,
					statusMessage: 'Missing id query',
					data: null,
				})
			);
		}

		const request = await client.query(
			`SELECT * FROM ApiUser WHERE id = '${req.query.id}'`
		);

		if (request.rows.length == 0 || !request.rows[0]?.id) {
			return res.status(404).json(
				new BaseObj({
					success: false,
					status: 404,
					statusMessage: "This user doesn't exist in the database",
					data: null,
				})
			);
		}

		const index = request.rows[0];

		const data = {
			id: index.id,
			key: index.apikey,
		};

		return res.json(
			new BaseObj({
				success: true,
				status: 200,
				statusMessage: 'OK',
				data: data,
			})
		);
	} catch (error) {
		console.log(error);

		return res.status(500).json(
			new BaseObj({
				success: false,
				status: 500,
				statusMessage: 'An unexpected error has occurred',
				data: null,
			})
		);
	} finally {
		client.release();
	}
});

router.post('/user/', async (req, res) => {
	const client = await Client.connect();
	const key = req.headers.authorization || req.query?.key;

	try {
		if (key == undefined) {
			return res.status(401).json(
				new BaseObj({
					success: false,
					status: 401,
					statusMessage: 'Missing token through authorization or query',
					data: null,
				})
			);
		}

		if (key != process.env.OWNER_KEY) {
			return res.status(403).json(
				new BaseObj({
					success: false,
					status: 403,
					statusMessage: 'This is an owner only route',
					data: null,
				})
			);
		}

		const id = req.body.id;

		const request = await client.query(
			`SELECT * FROM ApiUser WHERE id = '${id}'`
		);

		if (request.rows.length != 0 || request.rows[0]?.id) {
			return res.status(409).json(
				new BaseObj({
					success: false,
					status: 409,
					statusMessage: 'This user already exists in the database!',
					data: null,
				})
			);
		}

		if (!id || !req.body?.key) {
			return res.status(400).json(
				new BaseObj({
					success: false,
					status: 400,
					statusMessage: 'Incorrect format',
					data: null,
				})
			);
		}

		await client.query(`BEGIN`);
		const user = await client.query(
			`INSERT INTO ApiUser(id, apikey) VALUES('${id}', '${new Utils().ConvertKey(
				req.body.key as string
			)}') RETURNING *`
		);
		await client.query(`COMMIT`);

		const data = {
			id: user.rows[0].id,
			key: user.rows[0].apikey,
		};

		return res.json(
			new BaseObj({
				success: true,
				status: 200,
				statusMessage: 'OK',
				data: data,
			})
		);
	} catch (error) {
		console.log(error);

		return res.status(500).json(
			new BaseObj({
				success: false,
				status: 500,
				statusMessage: 'An unexpected error has occurred',
				data: null,
			})
		);
	} finally {
		client.release();
	}
});

router.patch('/user/', async (req, res) => {
	const client = await Client.connect();
	const apikey = req.headers.authorization || req.query?.key;

	try {
		if (apikey == undefined) {
			return res.status(401).json(
				new BaseObj({
					success: false,
					status: 401,
					statusMessage: 'Missing token through authorization or query',
					data: null,
				})
			);
		}

		if (apikey != process.env.OWNER_KEY) {
			return res.status(403).json(
				new BaseObj({
					success: false,
					status: 403,
					statusMessage: 'This is an owner only route',
					data: null,
				})
			);
		}
		if (!req.body) {
			return res.status(400).json(
				new BaseObj({
					success: false,
					status: 400,
					statusMessage: 'Missing a required param',
					data: null,
				})
			);
		}

		if (!req.query.id || !req.body.key) {
			return res.status(409).json(
				new BaseObj({
					success: false,
					status: 409,
					statusMessage: 'Incorrect format',
					data: null,
				})
			);
		}

		const id = req.query.id;
		const key = new Utils().ConvertKey(req.body.key as string);

		await client.query(`BEGIN`);
		const request = await client.query(
			`UPDATE ApiUser SET apikey = '${key}' WHERE id = '${id}' RETURNING *`
		);
		await client.query(`COMMIT`);

		const index = request.rows[0];

		const data = {
			id: index.id,
			key: index.apikey,
		};

		return res.json(
			new BaseObj({
				success: true,
				status: 200,
				statusMessage: 'OK',
				data: data,
			})
		);
	} catch (error) {
		console.log(error);

		return res.json(
			new BaseObj({
				success: false,
				status: 500,
				statusMessage: 'An unexpected error has occurred',
				data: null,
			})
		);
	} finally {
		client.release();
	}
});

router.delete('/user/', async (req, res) => {
	const client = await Client.connect();
	const key = req.headers.authorization || req.query?.key;

	try {
		if (key == undefined) {
			return res.status(401).json(
				new BaseObj({
					success: false,
					status: 401,
					statusMessage: 'Missing token through authorization or query',
					data: null,
				})
			);
		}

		if (key != process.env.OWNER_KEY) {
			return res.status(403).json(
				new BaseObj({
					success: false,
					status: 403,
					statusMessage: 'This is an owner only route',
					data: null,
				})
			);
		}

		if (!req.body) {
			return res.status(400).json(
				new BaseObj({
					success: false,
					status: 400,
					statusMessage: 'Missing a required param',
					data: null,
				})
			);
		}

		if (!req.query.id) {
			return res.status(400).json(
				new BaseObj({
					success: false,
					status: 400,
					statusMessage: 'Incorrect format',
					data: null,
				})
			);
		}

		const id = req.query.id as string;

		await client.query(`BEGIN`);
		await client.query(`DELETE FROM ApiUser WHERE id = '${id}'`);
		await client.query(`COMMIT`);

		return res.json(
			new BaseObj({
				success: true,
				status: 200,
				statusMessage: 'OK',
				data: null,
			})
		);
	} catch (error) {
		console.log(error);

		return res.status(500).json(
			new BaseObj({
				status: 500,
				statusMessage: 'An unexpected error has occurred',
				success: false,
				data: null,
			})
		);
	} finally {
		client.release();
	}
});

router.get(`/keys/`, async (req, res) => {
	const client = await Client.connect();
	const key = req.headers.authorization;

	if (key == undefined) {
		return res.status(401).json(
			new BaseObj({
				success: false,
				status: 401,
				statusMessage: 'Missing token through authorization or query',
				data: null,
			})
		);
	}

	if (key != process.env.OWNER_KEY) {
		return res.status(403).json(
			new BaseObj({
				success: false,
				status: 403,
				statusMessage: 'This is an owner only route',
				data: null,
			})
		);
	}

	if (!req.query.key) {
		return res.status(400).json(
			new BaseObj({
				success: false,
				status: 400,
				statusMessage: 'Incorrect format',
				data: null,
			})
		);
	}

	try {
		const request = await client.query(
			`SELECT apikey from ApiUser WHERE apikey = '${req.query.key}'`
		);

		if (request.rows.length == 0) {
			return res.json(
				new BaseObj({
					success: true,
					status: 200,
					statusMessage: 'OK',
					data: null,
				})
			);
		}

		return res.json(
			new BaseObj({
				success: true,
				status: 200,
				statusMessage: 'OK',
				data: { apikey: request.rows[0].apikey },
			})
		);
	} catch (error) {
		console.log(error);

		return res.status(500).json(
			new BaseObj({
				success: false,
				status: 500,
				statusMessage: 'An unexpected error has occurred',
				data: null,
			})
		);
	} finally {
		client.release();
	}
});

export default router;
