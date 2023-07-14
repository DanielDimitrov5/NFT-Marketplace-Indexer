import { ethers } from 'ethers';
import mongoose from 'mongoose';

import Item from './models/Item.js';
import Collection from './models/Collection.js';
import Offer from './models/Offer.js';

import NFTMarketplaceSDK from 'nft-mp-sdk';

import contractABI from './constants/MarketplaceABI.json' assert { type: 'json' };
import nftABI from './constants/NftABI.json' assert { type: 'json' };

import dotenv from 'dotenv';
dotenv.config();

const contractAddress = '0xf4351BA9Ca701Cf689442833CDA5F7FF18C2e00C';

const mongoURI = process.env.CONNECTION_STRING;

const provider = new ethers.providers.JsonRpcProvider(process.env.JSON_RPC_URL)
const contract = new ethers.Contract(contractAddress, contractABI, provider);
const sdk = new NFTMarketplaceSDK(provider, contractAddress, contractABI, nftABI, "", process.env.IPFS_PROVIDER);

const start = async () => {
    try {
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('Connected to MongoDB');
    }
    catch (err) {
        console.log("Error connecting to MongoDB", err);
    }

    await inputExistingCollections();
    await inputExistingItems();
    await inputExistingOffers();

    contract.on("LogCollectionAdded", async (id, nftCollection) => {
        console.log("LogCollectionAdded", id, nftCollection);

        const collection = new Collection({ id, nftCollection });
        await collection.save();

        console.log("Collection saved");
    });

    contract.on("LogItemAdded", async (id, nftContract, tokenId, owner) => {
        console.log("LogItemAdded", { id, nftContract, tokenId, owner });

        const { metadata } = await sdk.getItem(id);

        const itemNew = new Item({
            id: id.toString(),
            nftContract,
            tokenId: tokenId.toString(),
            owner,
            price: "0",
            name: metadata.data.name,
            description: metadata.data.description,
            image: metadata.data.image
        });

        await itemNew.save();

        console.log("Item saved");
    });

    contract.on("LogItemListed", async (id, nftContract, tokenId, seller, price) => {
        console.log("LogItemListed", { id, nftContract, tokenId: tokenId.toString(), seller, price: price.toString() });

        const item = await Item.findOne({ id: id.toString() });
        if (!item) {
            console.log("Item not found");
            return;
        }

        item.price = price.toString();
        await item.save();
    });

    contract.on("LogItemSold", async (id, nftContract, tokenId, seller, buyer, price) => {
        console.log("LogItemSold", { id, nftContract, tokenId: tokenId.toString(), seller, buyer, price: price.toString() });

        const item = await Item.findOne({ id: id.toString() });

        if (!item) {
            console.log("Item not found");
            return;
        }

        item.owner = buyer;
        item.price = "0";
        await item.save();
    });

    contract.on("LogOfferPlaced", async (id, nftContract, tokenId, buyer, price) => {
        console.log("LogOfferPlaced", { id, nftContract, tokenId: tokenId.toString(), buyer, price: price.toString() });

        const { item } = await sdk.getItem(id);

        if (!item) {
            console.log("Item not found");
            return;
        }

        const seller = item.owner;

        const findOffer = await Offer.findOne({ itemId: id, offerer: buyer, seller: seller });

        if (findOffer) {
            findOffer.price = price.toString();
            findOffer.isAccepted = false;

            await findOffer.save();

            console.log("Offer updated");
            return;
        }

        const offer = new Offer({ itemId: id.toString(), offerer: buyer, seller: seller, price: price.toString(), isAccepted: false });
        await offer.save();

        console.log("Offer saved");
    });

    contract.on("LogOfferAccepted", async (id, offerer) => {
        console.log("LogOfferAccepted", { id, offerer });

        const offer = await Offer.findOne({ itemId: id, offerer: offerer });

        if (!offer) {
            console.log("Offer not found");
            return;
        }

        offer.isAccepted = true;
        await offer.save();

        console.log("Offer updated");
    });

    contract.on("LogItemClaimed", async (id, claimer) => {
        console.log("LogItemClaimed", { id, claimer });

        const item = await Item.findOne({ id: id.toString() });

        if (!item) {
            console.log("Item not found");
            return;
        }

        item.owner = claimer;
        item.price = "0";
        await item.save();

        await Offer.deleteMany({ itemId: id.toString() });

        console.log("Item updated");
    });
};

const inputExistingCollections = async () => {
    await Collection.deleteMany({});

    const collectionCount = await contract.collectionCount();

    const collectionCountArr = Array.from(Array(parseInt(collectionCount.toString())).keys()).map(i => i + 1);

    const promises = collectionCountArr.map(id => contract.collections(id));
    const collections = await Promise.all(promises);

    const collectionsToSave = collections.map((collection, i) => {
        return {
            id: i + 1,
            nftCollection: collection
        };
    });

    await Collection.insertMany(collectionsToSave);

    console.log("Collections saved");
}

const inputExistingItems = async () => {
    await Item.deleteMany({});

    const { items, metadataArrModified } = await sdk.loadItems();

    const combinedItems = items.map((item, i) => {
        return {
            ...item,
            metadata: metadataArrModified[i]
        };
    });

    const itemsToSave = combinedItems.map(item => {
        return {
            id: item.id,
            nftContract: item.nftContract,
            tokenId: item.tokenId,
            owner: item.owner,
            price: item.price,
            name: item.metadata.name,
            description: item.metadata.description,
            image: item.metadata.image,
        };
    });

    await Item.insertMany(itemsToSave);

    console.log("Items saved");

}

const inputExistingOffers = async () => {
    await Offer.deleteMany({});

    const itemCoutn = await contract.itemCount();

    const itemCountArr = Array.from(Array(parseInt(itemCoutn.toString())).keys()).map(i => i + 1);

    const promises = itemCountArr.map(id => sdk.getOffers(id));

    const offers = await Promise.all(promises);

    const offersToSave = offers.map((offer, i) => {

        if (offer.length !== 0) {
            return {
                itemId: i + 1,
                offerer: offer[0].offerer,
                seller: offer[0].seller,
                price: offer[0].price,
                isAccepted: offer[0].isAccepted
            };
        }
    }).filter(offer => offer);

    await Offer.insertMany(offersToSave);

    console.log("Offers saved");
}

start();
