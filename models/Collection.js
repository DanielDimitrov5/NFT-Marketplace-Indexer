import { model, Schema } from "mongoose";

const collectionSchema = new Schema({
    id: String,
    nftCollection: String
});

const Coellction = model('Collection', collectionSchema);

export default Coellction;