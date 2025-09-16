require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
var admin = require("firebase-admin");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// firebase-admin-config
var serviceAccount = require("./firebase-admin-private-key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req?.headers?.authorization;
  const token = authHeader.split(" ")[1];
  if (!token) res.status(401).send({ message: "Unauthorized User" });

  // now we have to validate this token with firebase admin
  const userInfo = await admin.auth().verifyIdToken(token);
  req.tokenEmail = userInfo.email;
  next();
};

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token)
    return res.status(401).send({ message: "Unauthorized/ Anonimous User" });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).send({ message: "Unauthorized User" });
    req.decoded = decoded;
  });
  next();
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2dlckac.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const jobsColl = client.db("CareerCode").collection("jobs");
    const applicationsColl = client.db("CareerCode").collection("applications");

    // authentication api
    app.post("/jwt", (req, res) => {
      const userData = req.body;
      const token = jwt.sign(userData, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });

      res.cookie("token", token, { httpOnly: true, secure: false });

      res.send({ success: true });
    });

    // job api
    // bad way to aggregate
    app.get("/jobs/applications", verifyToken, async (req, res) => {
      const email = req.query.email;
      const reqEmail = req.decoded.email;
      console.log(reqEmail);
      if (reqEmail != email)
        return res.status(403).send("You are not permited/Forbidden.");

      const projection = {
        title: 1,
        location: 1,
        jobType: 1,
        applicationDeadline: 1,
        salaryRange: 1,
        description: 1,
        company: 1,
        requirements: 1,
        company_logo: 1,
        hr_email: 1,
      };
      const query = {};
      if (email) query.hr_email = email;

      const jobs = await jobsColl.find(query, { projection }).toArray();

      for (const job of jobs) {
        const applicationQuery = { jobId: job._id.toString() };
        const application_count = await applicationsColl.countDocuments(
          applicationQuery
        );
        job.application_count = application_count;
      }

      res.send(jobs);
    });

    app.get("/jobs", async (req, res) => {
      const projection = {
        title: 1,
        location: 1,
        jobType: 1,
        applicationDeadline: 1,
        salaryRange: 1,
        description: 1,
        company: 1,
        requirements: 1,
        company_logo: 1,
        hr_email: 1,
      };
      const email = req.query.email;
      const query = {};
      if (email) query.hr_email = email;

      const jobs = await jobsColl.find(query, { projection }).toArray();
      res.send(jobs);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const job = await jobsColl.findOne({ _id: new ObjectId(id) });
      res.send(job);
    });

    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobsColl.insertOne(newJob);
      res.send(result);
    });

    // job application api
    app.get("/applications", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const tokenEmail = req.tokenEmail;

      if (email != tokenEmail)
        return res.status(401).send({ message: "Unauthorized User" });

      const job_id = req.query.job_id;
      const query = {};
      if (email) query.applicant = email;
      if (job_id) query.jobId = job_id;
      const applications = await applicationsColl.find(query).toArray();

      // bad way to aggregate
      for (const application of applications) {
        const jobId = application.jobId;
        const job = await jobsColl.findOne({ _id: new ObjectId(jobId) });
        application.title = job.title;
        application.company = job.company;
        application.location = job.location;
        application.company_logo = job.company_logo;
      }
      res.send(applications);
    });

    app.post("/applications", async (req, res) => {
      const application = req.body;
      const result = await applicationsColl.insertOne(application);
      res.send(result);
    });

    app.patch("/applications/:id", async (req, res) => {
      const updatedStatus = req.body.status;
      console.log(updatedStatus);
      const query = { _id: new ObjectId(req.params.id) };
      const update = { $set: { status: updatedStatus } };

      const result = await applicationsColl.updateOne(query, update);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("hello coder we are here to solve your problem!");
});

app.listen(port, () => {
  console.log(`Career-code-server running on port ${port}`);
});
