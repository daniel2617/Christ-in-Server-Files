var mongoose = require('mongoose');
var statusSchema = new mongoose.Schema({
    id: [],
    images: [{
        time: Number,
        url: String
    }],
    ownerId: Number

});

module.exports = mongoose.model('status', statusSchema);