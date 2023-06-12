require("dotenv").config();
const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// Middlere

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  console.log(authorization);
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    console.log(err);
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xxlectq.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const dbConnect = async () => {
  try {
    client.connect();
    console.log("Database Connected Successfully✅");
  } catch (error) {
    console.log(error.name, error.message);
  }
};
dbConnect();

const classCollection = client.db("summerDB").collection("classes");
const instructorsCollection = client.db("summerDB").collection("instructors");
const selectedCollection = client.db("summerDB").collection("selected");
const usersCollection = client.db("summerDB").collection("users");
const paymentCollection = client.db("summerDB").collection("payments");

app.get("/", (req, res) => {
  res.send("school is running");
});

app.post("/jwt", (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1h",
  });

  res.send({ token });
});

const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await usersCollection.findOne(query);
  if (user?.role !== "admin") {
    return res.status(403).send({ error: true, message: "forbidden message" });
  }
  next();
};

// User Collections

app.get("/users", verifyJWT, async (req, res) => {
  const result = await usersCollection.find().toArray();
  res.send(result);
});

app.post("/users", async (req, res) => {
  const user = req.body;
  const query = { email: user.email };
  const existingUser = await usersCollection.findOne(query);
  if (existingUser) {
    return res.send({ message: "User already exist" });
  }
  const result = await usersCollection.insertOne(user);
  res.send(result);
});

/*----------------------------------------------------------------------------------------*/

// User Admin collection

app.patch("/users/admin/:id", async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      role: "admin",
    },
  };
  const result = await usersCollection.updateOne(filter, updateDoc);
  res.send(result);
});

app.get("/users/admin/:email", verifyJWT, async (req, res) => {
  const email = req.params.email;

  if (req.decoded.email !== email) {
    res.send({ admin: false });
  }
  const query = { email: email };
  const user = await usersCollection.findOne(query);
  const result = { admin: user?.role === "admin" };
  res.send(result);
});

/*/----------------------------------------------------------------------------------------------*/

// User Instructor Collections

app.get("/users/instructors/:email", verifyJWT, async (req, res) => {
  const email = req.params.email;
  console.log(req.decoded);
  if (req.decoded.email !== email) {
    res.send({ instructors: false });
  }
  const query = { email: email };
  const user = await usersCollection.findOne(query);
  console.log(user);
  const result = { instructors: user?.role === "instructor" };
  res.send(result);
});

app.patch("/users/instructor/:id", async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      role: "instructor",
    },
  };
  const result = await usersCollection.updateOne(filter, updateDoc);
  res.send(result);
});

app.get("/instructors", async (req, res) => {
  const result = await instructorsCollection.find().toArray();
  res.send(result);
});

/*-----------------------------------------------------------------------------------------*/

// Class Collections

app.patch("/class/approved/:id", async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      role: "approved",
    },
  };
  const result = await classCollection.updateOne(filter, updateDoc);
  res.send(result);
});

app.patch("/class/denied/:id", async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      role: "denied",
    },
  };
  const result = await classCollection.updateOne(filter, updateDoc);
  res.send(result);
});

app.get("/classes", async (req, res) => {
  const result = await classCollection.find().toArray();
  res.send(result);
});

app.post("/addclass", async (req, res) => {
  const body = req.body;
  body.createdAt = new Date();

  const result = await classCollection.insertOne(body);
  console.log(result);
  if (!body) {
    return res.status(404).send({ message: "body data not found" });
  }
  res.send(result);
});

app.get("/addclass/:email", async (req, res) => {
  const result = await classCollection
    .find({ email: req.params.email })
    .toArray();
  res.send(result);
});
app.get("/loadedclass/:email", async (req, res) => {
  const result = await classCollection
    .find({ email: req.params.email })
    .toArray();
  res.send(result);
});

/*------------------------------------------------------------------------------*/

// Selected collection

app.delete("/selected/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await selectedCollection.deleteOne(query);
  res.send(result);
});

app.get("/selected", verifyJWT, async (req, res) => {
  const email = req.query.email;
  if (!email) {
    res.send([]);
  }
  const decodedEmail = req.decoded.email;
  if (email !== decodedEmail) {
    return res.status(403).send({ error: true, message: "forvidden access" });
  }
  const query = { email: email };
  const result = await selectedCollection.find(query).toArray();
  res.send(result);
});

app.post("/selected", async (req, res) => {
  const item = req.body;
  console.log(item);
  const result = await selectedCollection.insertOne(item);
  res.send(result);
});

/*------------------------------------------------------------------------------*/

// Pyment collections

app.post("/create-payment-intent", verifyJWT, async (req, res) => {
  const { price } = req.body;
  const amount = parseInt(price * 100);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    payment_method_types: ["card"],
  });

  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

app.post("/payments", async (req, res) => {
  const payment = req.body;
  const insertResult = await paymentCollection.insertOne(payment);
  const query = {
    _id: { $in: payment.classItems.map((id) => new ObjectId(id)) },
  };
  const deleteResult = await classCollection.deleteMany(query);
  res.send({ result: insertResult, deleteResult });
});

app.listen(port, () => {
  console.log(`Summer champ is running on port ${port}`);
});
