import mongoose from 'mongoose'
const { Schema } = mongoose;

const UserSchema = Schema({
    name: String,
    email: { type: String, unique: true },
    password: String
})

export const UserModal = mongoose.model('User', UserSchema);