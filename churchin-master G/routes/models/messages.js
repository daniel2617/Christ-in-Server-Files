
var mongoose = require('mongoose');

var message = new mongoose.Schema({
    fromname: String,
    toname: String,
    senderId: Number,
    senderName: String,
    senderImage: String,
    fromImage: String,
    toImage: String,
    fromId: Number,
    toId: Number,
    date: String,
    time: String,
    message: String,
    dateString: Number,
    deleteFrom: [],
    index: Number,
    read: String,
    unique: String,
    file: String,
    module: String,
    fileUrl: String,

});
module.exports = mongoose.model('message', message);



