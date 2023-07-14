import { model, Schema } from "mongoose";

const itemSchema = new Schema({
    id: {
        type: Number, unique: true, required: [true, 'id is required'], min: 1, validate: {
            validator: Number.isInteger,
            message: '{VALUE} is not an integer value'
        }
    },
    nftContract: { type: String, required: [true, 'nftContract is required'] },
    tokenId: { type: Number, required: [true, 'tokenId is required'] },
    owner: { type: String, required: [true, 'owner is required'] },
    price: { type: Number, required: [true, 'price is required'] },
    name: String,
    description: String,
    image: String,
});

const Item = model('Item', itemSchema);

export default Item;