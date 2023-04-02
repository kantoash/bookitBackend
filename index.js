import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { UserModal } from "./models/User.js";
import bcrypt, { genSaltSync } from "bcrypt";
import cookieParser from "cookie-parser";
import imageDownloader from "image-downloader";
import path from "path";
import { PlaceModel } from "./models/Place.js";
import multer from "multer";
import fs from "fs";
import { BookingModel } from "./models/Booking.js";
import * as dotenv from 'dotenv'
dotenv.config()


const app = express();
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(path.join(path.resolve(), "/uploads")));
app.use(
  cors({
    credentials: true,
    origin: `${process.env.CLIENT_SIDE_URL} || http://localhost:3000`,
  })
);
mongoose.connect(
  `${process.env.MONGO_URL}`
);
const jwtSecret = process.env.JWT_SECRET;

app.get("/test", (req, res) => {
  res.json("test ok");
});
//
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const userDoc = await UserModal.create({
      name,
      email,
      password: bcrypt.hashSync(password, genSaltSync(10)),
    });
    res.json(userDoc);
  } catch (error) {
    res.status(422).json(error);
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const userDoc = await UserModal.findOne({ email });
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      jwt.sign(
        {
          email: userDoc.email,
          id: userDoc._id,
        },
        jwtSecret,
        {},
        async (err, token) => {
          if (err) throw err;
          const { name, email, _id } = userDoc;
          res.cookie("token", token).json({ name, email, _id });
        }
      );
    } else {
      res.status(422).json("pass not ok");
    }
  } else {
    res.json("not found");
  }
});

app.get("/api/profile", async (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, user) => {
      if (err) throw err;
      const { name, email, _id } = await UserModal.findById(user.id);
      res.json({ name, email, _id });
    });
  } else {
    res.json("no token");
  }
});

app.post("/api/logout", (req, res) => {
  res.cookie("token", "").json(true);
});

app.post("/uploads-by-link", async (req, res) => {
  const { link } = req.body;
  const newName = "photo" + Date.now() + ".jpg";
  await imageDownloader.image({
    url: link,
    dest: path.join(path.resolve(), "/uploads/", newName),
  });
  res.json(newName);
});

const photosMiddleware = multer({ dest: "uploads" });
app.post("/uploads", photosMiddleware.array("photos", 100), (req, res) => {
  const uploadPhoto = [];
  for (let i = 0; i < req.files.length; i++) {
    const { path, originalname } = req.files[i];
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newPath = path + "." + ext;
    fs.renameSync(path, newPath);
    uploadPhoto.push(newPath.substring(8));
  }
  res.json(uploadPhoto);
});

app.post("/api/createPlaces", (req, res) => {
  const { token } = req.cookies;
  const { title, address, addedPhotos, description, perks, maxGuests, price } =
    req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) {
      throw err;
    }
    const placeDoc = await PlaceModel.create({
      owner: userData.id,
      title,
      address,
      photos: addedPhotos,
      description,
      perks,
      maxGuests,
      price,
    });
    res.json(placeDoc);
  });
});

app.post("/api/createBooking", async (req, res) => {
  const { place, user, checkIn, checkOut, name, phone, price } = req.body;
  const bookingDoc = await BookingModel.create({
    place: place._id,
    user: user._id,
    checkIn: checkIn,
    checkOut: checkOut,
    name: name,
    phone: phone,
    price: price,
  });
  res.json(bookingDoc);
});

app.get("/account/user-places", async (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) {
      throw err;
    }
    const { id } = userData;
    const Userplaces = await PlaceModel.find({ owner: id });
    res.json(Userplaces);
  });
});

app.get("/account/user-bookings", async (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) {
      throw err;
    }
    const { id } = userData;
    const bookingsDoc = await BookingModel.find({ user: id });
    res.json(bookingsDoc);
  });
});

app.get("/places/:id", async (req, res) => {
  const { id } = req.params;
  const placeData = await PlaceModel.findById(id);
  res.json(placeData);
});

app.put("/api/updatePlaces", async (req, res) => {
  const { token } = req.cookies;
  const {
    id,
    title,
    address,
    addedPhotos,
    description,
    perks,
    maxGuests,
    price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await PlaceModel.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title,
        address,
        photos: addedPhotos,
        description,
        perks,
        maxGuests,
        price,
      });
      await placeDoc.save();
      res.json({ placeDoc });
    }
  });
});

// home page to get All places
app.get("/api/Allplaces", async (req, res) => {
  const places = await PlaceModel.find();
  res.json(places);
});

app.listen(process.env.PORT, () => {
  console.log("listening api calls port",process.env.PORT);
});
