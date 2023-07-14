import { model, Schema } from "mongoose";

const offerSchema = new Schema({
    itemId: Number,
    offerer: String,
    seller: String,
    price: Number,
    isAccepted: Boolean
});

const Offer = model('Offer', offerSchema);

export default Offer;