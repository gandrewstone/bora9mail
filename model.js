Messages    = new Meteor.Collection("messages");
Labels      = new Meteor.Collection("labels");
UserRecords = new Meteor.Collection("userRecords");


/*  Add in a fake message
Messages.insert({ 
            from: "foo",
            to: "bar",
            subject: "subj",
            body: "bod"
        });
*/


UserRecords.allow({
  insert: function(options) {return true; },
  remove: function(options) { return true; }
});


Messages.allow({
  insert: function(options) { return true; }
});

Labels.allow({
  insert: function(options) { return true; },
  update: function(options) { return true; }
});

//Returns the created label's id
createLabel = function(userid, labelname, parent, builtin)
{
  console.log( "Parent is : '" + parent +"'");
  var newid;
  if (parent)
  {
    var par = Labels.findOne({user:userid, _id: parent});
    Labels.update({user:userid, _id: parent},{$set: {expanded: true}});
    newid =  Labels.insert({user: userid, name: labelname, parent: parent,
			    level: par.level + 1, dirty:0, expanded:false,
			    builtin: builtin, isAttr: par.isAttr});
  }
  else
    newid = Labels.insert({user: userid, name: labelname, parent: null,
			  level: 0, dirty:0, expanded:false, builtin: builtin,
			  isAttr: (builtin && (labelname=="attributes"))});
  console.log ("New label id is: " + newid);
  console.log (Labels.findOne({_id: newid}));
  return newid;
}

//returns number of renamed labels (should be 1 or 0)
renameLabel = function(userid, id, newname)
{
  return Labels.update({user:userid, _id: id, builtin: false},
			     {$set: {name: newname}});
}

//returns number of moved labels (should be 1 or 0)
moveLabel = function(userid, id, newparent)
{
  return Labels.update({user:userid, _id: id, builtin: false},
			     {$set: {parent: newparent}});
  //TODO: update level and childrens' levels.
}

//GOS - I don't think we need this function...
labelAddMessage  = function(userid, labelname,messageId)
  {
  //var val = Labels.findOne({user:userid, name: labelname});
  //console.log("name " + val.name + " unread " + val.unread + "dirty " + val.dirty);
  var result = Labels.update({user:userid, name: labelname}, {$inc: {unread: 1, dirty: 1}});
  console.log("updated " + userid + " labelname " + labelname + " result " + result);
  var val = Labels.findOne({user:userid, name: labelname});
  console.log("name " + val.name + " unread " + val.unread + "dirty " + val.dirty);
  }


// Remote functions that clients can invoke
Meteor.methods({
    //namecoinLookup: function (name) { return "foo"; },
    clientUserLogin: function (username,password)
      {
            // Note, attacker could use this to poll random user ids and get encrypted
            // mail records.  We should not allow userId to be set unless server password is correct,
            // for those users who register a server password
            // Or maybe server never sees username, only sha256 of username
      var userRecord = UserRecords.findOne({username: username, password: password});
      if (userRecord == null) 
        {
        // TODO delay to stop brute force
        console.log("User record " + username + ":" + password + " not found");
        //throw "Record not found";
        return 0;
        }
      console.log("Found! ");
      this.setUserId(username);
      return 1;
      },
    userLogin: function (username, password) 
      {
      console.log("Attempt to log in " + username + " Password: " + password);
      var userRecord = UserRecords.findOne({username: username, password: password});
      if (userRecord == null)
        {
        // TODO delay to stop brute force
        console.log("NOPE");
        throw "Record not found";
        return null;
        }
      console.log("Found! " + userRecord.encdata );
      this.setUserId(username);
      return userRecord.encdata;
      },
    checkUser: function (username)
      {
      console.log("looking for " + username);
      if (UserRecords.findOne({username: username}) != null) 
        {
        console.log("found!");
        return true;
        }
      // TODO delay to stop phishing for usernames
      return false;
      },
    setPublicKey: function(key)
      {
      console.log("setPublicKey for: " + this.userId + " to " + key );
      UserRecords.update({name:this.userId},{$set: { publickey: key }});
      },
    createUser: function (username, password, encdata)
      {
	if (UserRecords.findOne({username: username}) != null) return false;
	this.setUserId(username);
	UserRecords.insert({ username: username, password: password, publickey: null, encdata: encdata});
	var attid = createLabel(username, "attributes",null, true);
	var delid = createLabel(username, "deleted", null, true);
	createLabel(username, "drafts", null, true);
	createLabel(username, "inbox", null, true);
	createLabel(username, "sent", null, true);
	createLabel(username, "spam", delid, true);
	createLabel(username, "starred", attid, true);
	createLabel(username, "unread", attid, true);
	createLabel(username, "priority1", attid, true);
	createLabel(username, "priority2", attid, true);
	createLabel(username, "priority3", attid, true);
	console.log("created user " + username + " PW: " + password + " data: " + encdata);
	//Label tree is expanded by default.  Collapse new top-level labels.
	Meteor.call("expandLabelToggle", attid); 
	Meteor.call("expandLabelToggle", delid); 
	return true;
      },
    wipeMessages: function (options) 
      { 
      Messages.remove({}); 
      Labels.remove({});
      UserRecords.remove({});
      },
    //Clear all labels and then set label to labid
    setOneLabel: function (labid, msgIdList)
      {
	Messages.update({owner:this.userId, id: {$in: msgIdList}},{$set: {labels:[labid]}},{multi: true})
      },
    deleteMail: function(messageIdList)
      {
      var dellbl = Labels.findOne({user: this.userId, name: 'deleted', builtin: true}, {fields: {_id: 1}});
      for(var i = 0; i<messageIdList.length; i++)
        {
        var msg = Messages.findOne({owner:this.userId, id: messageIdList[i]});
        if ((msg.labels.length > 1) || (msg.labels[0] != dellbl._id))  // If a message has any label besides 'deleted', delete just moves the message to the 'deleted' label
          {
          console.log("moving mail: " + messageIdList[i] + " to deleted label");
          Messages.update({owner:this.userId, id: messageIdList[i]},{$set: {labels:[dellbl._id]}});
          }
        else
          {
          Messages.remove({owner:this.userId,id:messageIdList[i]});  // If the message is in deleted, then really remove it.
          console.log("deleting mail: " + messageIdList[i]);
          }
        }
      return true;
      },

    createLabel: function(label, pid)
      {
      if (!this.userId) return "Must log in first";
      var newid = createLabel(this.userId,label, pid, false);
      console.log("User: " + this.userId + " Creating label:" + label + " (" + newid + ")");
      return newid;
      },
    renameLabel: function(labid,labname)
      {
      if (!this.userId) return "Must log in first";
      if (renameLabel(this.userId,labid,labname))
	{
	  console.log("User " + this.userId + " renaming label " + labid + " to " + labname);
	  return "Applied";
	}
      else
	console.log("Rename of " + labid + " is not permitted");
      },
    expandLabelToggle: function(labid)
      {
	var curval = Labels.findOne({user:this.userId, _id: labid}).expanded;
	console.log("Toggle expansion of label " + labid);
	var result = Labels.update({user:this.userId, _id: labid},
			           {$set: {expanded:  !curval}});
      },
    applyAttrToMessages: function(labelId, messageIdList)
      {
	//console.log("applyLabelToMessages");
	//var labl = Labels.findOne({user: this.userId, _id: labelId});
	Messages.update({owner: this.userId,id: {$in: messageIdList}},{$push: {attrs:labelId}}, {multi: true});
      },
    applyLabelToMessages: function(labelId, messageIdList)
      {
	Messages.update({owner: this.userId,id: {$in: messageIdList}},{$push: {labels:labelId}}, {multi: true});
      },
    clearAttrFromMessages: function(labelId, messageIdList)
      {
	//console.log("clearAttrFromMessages");
	//var labl = Labels.findOne({user: this.userId, _id: labelId});
	return Messages.update({owner: this.userId,attrs:labelId,id: {$in: messageIdList}},{$pull: {attrs:labelId}}, {multi: true});
      },
    clearLabelFromMessages: function(labelId, messageIdList)
      {
	var count = Messages.update({owner: this.userId,labels:labelId,id: {$in: messageIdList}},{$pull: {labels:labelId}}, {multi: true});
	console.log("Cleared labels from " + count + " message(s)");
	//Add 'deleted' label to any messages with no other labels
	var dellbl = Labels.findOne({user: this.userId, name: 'deleted', builtin: true}, {fields: {_id: 1}});
	var cnt2 = Messages.update({owner: this.userId,labels: [],id: {$in: messageIdList}},{$set: {labels: [dellbl._id]}}, {multi: true});
	console.log("Set 'deleted' label on " + cnt2 + " message(s)");
	return count;
      },
    clearKnownAttrFromMessages: function(at, messageIdList)
      {
	//'at' must be one of: attributes, priority[1,2,3], unread, starred
	//Can only use this method for builtin attributes. Otherwise there
	//could be duplicate names and findOne could choose the wrong one.
	console.log("clearKnownAttrFromMessages");
	attrID = Labels.findOne({user: this.userId, name: at, builtin: true},{fields: {_id: 1}});
	Messages.update({owner: this.userId,attrs: attrID._id,id: {$in: messageIdList}},{$pull: {attrs:attrID._id}}, {multi: true});
        
      return true;
      },

    sendmail: function(to, from, inreplyto, enckey, subject,preview,message,id,keepcopy)
      {
      var d = Date.now();
      if (!this.userId) { console.log("Send but no logged in user!"); return ERROR_NOT_LOGGED_IN; }
      if (to == null) // sending to drafts
        {
        //console.log("Saving draft");
        var drlbl = Labels.findOne({user: this.userId,name: "drafts", builtin: true});
        var unlbl = Labels.findOne({user: this.userId,name: "unread", builtin: true});
        console.log("Saving draft to label " + drlbl.name + " (" + drlbl._id + ")");
	Messages.insert({ owner: this.userId, to: username, from: from, date: d, cipherkey: enckey, re: inreplyto, subject: subject, preview: preview, message: message, id: id, labels:[drlbl._id], attrs: [unlbl._id], importance:0, });
	
        return;
        }

      // Normal mail send
      keepcopy = keepcopy | false;  //GOS - set a default value of false.
      console.log("sending mail to " + JSON.stringify(to) + " " + to.typ);
      if (to.typ == "local")
        {
        var username = to.address.split("@")[0];
        var rec = UserRecords.findOne({username: username});
        if (rec == null) 
          {
          // TODO, client should have eliminated this possibility.  Mark a hacker strike against sending user. 
          return false;  // Could not find the user
          }

        fromuserid = from.split("@")[0];   // From is the full address     
        console.log("sending local mail to " + username + " from: " + from);
        // I want 2 separate copies so that sender and receiver can both delete their own copy
        var slbl = Labels.findOne({user: username,name: "inbox",builtin: true});
        var unlbl = Labels.findOne({user: username,name: "unread",builtin: true});
        console.log("Sending mail to label " + slbl.name + " (" + slbl._id + ")");
        Messages.insert({ owner: username,to: username, from: from, date: d, cipherkey: enckey, re: inreplyto, subject: subject, preview: preview, message: message, id: id, labels:[slbl._id], attrs: [unlbl._id], importance:0, });

	if (keepcopy) 
          {
            var vlbl = Labels.findOne({user: this.userId,name: "sent",builtin:true},{fields: {_id:1}});
            console.log("Saving mail to label 'sent' (" + vlbl._id + ")");
           Messages.insert({ owner: this.userId,to: username, from: from, date: d, cipherkey: enckey, re: inreplyto, subject: subject, preview: preview, message: message, id: id+1, labels:[vlbl._id], attrs:[], importance:0, });      
	  }
        }
      if (to.typ == "rfc822") 
        {
        return "External Gateway not implemented!";
        }
      if (to.typ == "256k1")
        {
        return "Send to public key not implemented!";
        }
      if (to.typ == "nmc")
        {
        return "Send to namecoin registration not implemented!";
        }
      return null;
      }

});
