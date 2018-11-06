var mongoose = require('mongoose');
var likeSchema = new mongoose.Schema({
    postId: String,
    likeId: String,
    postOwnerImage: String,
    postOwnerNames: String,
});

module.exports = mongoose.model('like', likeSchema);