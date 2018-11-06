var mongoose = require('mongoose');
var statusSchema = new mongoose.Schema({
    myId: Number,
    friendId: Number,
    postId: Number,
    report: String,
    date: Number

});

module.exports = mongoose.model('report', statusSchema);