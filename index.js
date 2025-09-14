require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(cors());
app.use(express.json());

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

    // job api
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
      };
      const jobs = await jobsColl.find({}, { projection }).toArray();
      res.send(jobs);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const job = await jobsColl.findOne({ _id: new ObjectId(id) });
      res.send(job);
    });

    // job application api
    app.get("/applications", async (req, res) => {
      const email = req.query.email;
      const query = { applicant: email };
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
