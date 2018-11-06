var mongoose = require('mongoose');
var postSchema = new mongoose.Schema({
        postId: String,
        postOwner: Number,
        postOwnerImage: String,
        postOwnerNames: String,
        postDate: String,
        postText: String,
        postImage: String,
        postLikes: Number,
        postComments: Number,
        postTime: String,
        postNumber: Number,
        gradient: String,
        notSee: [{
                id: Number
        }]

});

module.exports = mongoose.model('post', postSchema);