
forEachDisplayedMessage = function (apply)
  {
    //console.log("Trace - forEachDisplayedMessage (messageCatalog.js,2)");
       if (Session.get("page") == "message") // If a message is being shown, it is implicitly the selection.
         {
         var messageId = Session.get("curMessage");
         return [messageId];
         }
       // Otherwise, its the checked messages
       var elements = document.getElementById("mailListTable").getElementsByClassName("summaryCheckBox");
       var lst = [];
       for(var i = 0; i<elements.length; i++)
         {
         var elem = elements[i];
         var result = apply(elem);
         if (result)
           {
           lst[lst.length] = result;
           } 
         }
    return lst;  
  }

getSelectedMessages = function ()
  {
    //console.log("Trace - getSelectedMessages (messageCatalog.js,25)");
       if (Session.get("page") == "message") // If a message is being shown, it is implicitly the selection.
         {
         var messageId = Session.get("curMessage");
         return [messageId];
         }
       // Otherwise, its the checked messages
       if (Session.get("page") == "main") //Verify main page
	 {
	 var elements = document.getElementById("mailListTable").getElementsByClassName("summaryCheckBox");
	 var dellst = [];
	 for(var i = 0; i<elements.length; i++)
           {
           var elem = elements[i];
           if (elem.checked)
             {
             dellst[dellst.length] = elem.id;
             //console.log("deleting mail: " + elem.id);
	     }
           }
         }
    return dellst;  
  }

//
//*** NOTE: These Autorun functions run at startup, and again at initialization,
//          before a lot of stuff has been set up or anyone is logged in.  So
//          we may want to check for being logged in or something before doing
//          anything else.
//

//Run automatically when 'numCheckedEmails' changes
//Set up the list of labels of selected emails
//Set the AllEmails checkbox correctly.
Tracker.autorun(function ()
  {
    //console.log("Trace - Autorun for numCheckedEmails (messageCatalog.js,54)");
    var selectnum = Session.get("numCheckedEmails");
    if (selectnum === undefined)
      return;
    var elements;
    console.log("NumCheckedEmails changed to " + selectnum);

   //Set the AllEmails checkbox correctly.
    if (document.getElementById("mailListTable"))
    {
      elements = document.getElementById("mailListTable").getElementsByClassName("summaryCheckBox");
      document.getElementById("allEmails").checked = (selectnum==elements.length);
    }

    if (selectnum == 0)
    {
      Session.set("labelFullList",[]);
      Session.set("labelPartList",[]);
      return;
    }
    var mids = Tracker.nonreactive(getSelectedMessages);
    var m1 = Messages.findOne({owner: globals.username, id: mids[0]},
				{fields: {labels: 1, attrs: 1}});
    var mlabels = m1.labels.concat(m1.attrs);
    //console.log("initial mlabels: "+mlabels);
    if (selectnum < 2)
    {
      Session.set("labelFullList",mlabels);
      Session.set("labelPartList",[]);
      return;
    }
    var plabels = mlabels.slice(0);//copy array
    var mcursor = Messages.find({owner: globals.username, id: { $in: mids}},
				{fields: {labels: 1, attrs: 1}});
    mcursor.forEach(function(msg,idx,c) 
      {
	var alllabels = [];
	var i;
	for (i=0;i<msg.labels.length;i++)
	{
	  if (mlabels.indexOf(msg.labels[i]) != -1)
	    alllabels.push(msg.labels[i]);  //AND all label arrays
	  if (plabels.indexOf(msg.labels[i]) == -1)
	    plabels.push(msg.labels[i]);   //OR all label arrays
	}
	for (i=0;i<msg.attrs.length;i++)
	{
	  if (mlabels.indexOf(msg.attrs[i]) != -1)
	    alllabels.push(msg.attrs[i]);  //AND all label arrays
	  if (plabels.indexOf(msg.attrs[i]) == -1)
	    plabels.push(msg.attrs[i]);   //OR all label arrays
	}
	mlabels=alllabels;
	//console.log("new mlabels: "+mlabels);
      });
		
      Session.set("labelFullList",mlabels);
      Session.set("labelPartList",plabels);
  });
      



//Keep track of the number of unread messages
Tracker.autorun(function ()
  {
    //console.log("Trace - Autorun for unread messages (messageCatalog.js,118)");
    //console.log("Auto Counting unread messages");

    if (Session.get("loggedIn") && Session.get("cnxn")) 
    {
      if (!globals.username)
      {
	console.log("No USER NAME!!!!");
	return;
      }
      Labels.find({user: globals.username},{fields: {_id:1}}).forEach(
        function(labl)
	{
	  var sesName = "unread_in_" + labl._id;
	  //console.log(sesName);
	  var count = Messages.find({owner: globals.username, $or: [{labels: labl._id},{attrs: labl._id}], attrs: globals.labelIds.unread}).count();


	  //console.log(sesName + " has " +count);
	  Session.set(sesName,count);
	});
    }
  });	

//Keep track of the longest labels
Tracker.autorun(function ()
  {
    //console.log("Trace - Autorun for label length changes (messageCatalog.js,145)");
    //console.log("Auto Checking label length");

    if (Session.get("loggedIn") && Session.get("cnxn")) 
    {
      if (!globals.username)
      {
	console.log("No USER NAME!!!!");
	Session.set("LabelBarWidth",200);
	return;
      }
      var wmax = 200;
      var labs = Labels.find({user: globals.username, parent: null},
			      {fields: {level:1,name:1,expanded:1}}).fetch();
      console.log(labs[0]._id);
      for (var i=0;i<labs.length;i++)
      {
	var lwid = labs[i].level*15 + labs[i].name.length*8 + 150;
	wmax = (wmax > lwid ? wmax : lwid);
	//console.log(labs[i].name);
	
	if (labs[i].expanded == true)  //insert new labels after parent
	{
	  var ins = Labels.find({user: globals.username, parent: labs[i]._id},
				{fields: {level:1,name:1,expanded:1}}).fetch();
	  if (ins.length) 
	    labs = labs.concat(ins);
	}
      }

      Session.set("labelBarWidth",wmax);
/*
      var sar;
      sar = Labels.find({user: globals.username},{fields: {level:1,name:1}}).map(
        function(labl)
	{
	  return labl.level * 15 + labl.name.length * 10 + 70;
	});
      sar.sort(function(a,b) {return b-a});  //numerical descending sort
      Session.set("labelBarWidth",(sar[0]<200 ? 200 : sar[0]));
*/    
    }
    else
    {
      	Session.set("LabelBarWidth",200);
    }
  });	


Template.messageCatalog.events(
  {
   'click .compose': function () 
     {
     //console.log("Trace - messageCatalog event click .compose (messageCatalog.js,198)");
     resetCompose();
     SetPage("compose");
     },
   'click #deleteMessages': function ()
     {
       //console.log("Trace - messageCatalog event click #delete (messageCatalog.js,198)");
       Meteor.call("deleteMail", getSelectedMessages(), function(error, result) { if (error) DisplayError("server connection error"); else DisplayWarning("Deleted"); } );
       Session.set("numCheckedEmails",0);  // We are about to delete all checked emails...
       SetPage("main");  // This mail is being deleted so we have to show something else
     },
/*   'click #applyLabel': function (event)
     {
       var mode = !Session.get("applyLabelMode");
       Session.set("applyLabelMode", mode);
       if (mode)
         {
         if (Session.get("page") == "message")  // Let's make sure there are some messages to label
           {
           DisplayHelp("Click the label you want applied to this message.");
           }
        else
           {
           var sel = getSelectedMessages();
           if (sel.length == 0) DisplayError("Select some messages before labelling them");
           DisplayHelp("Click the label you want applied to the selected messages.");
           return;
           }
         }
     }
  */ 
  });

  Template.messageCatalog.helpers({
    sidebar: function()
    {
       //console.log("Trace - messageCatalog helper sidebar (messageCatalog.js,234)");
/*
      var ret = {'width':"200px",'margin-left':"-200px"};
      ret['width'] = Session.get("labelBarWidth")+"px";
      ret['margin-left'] = "-"+Session.get("labelBarWidth")+"px";
      return ret;
*/
      var w = Session.get("labelBarWidth");
      if (!w)
	{
	  console.log("No labelBarWidth session var!");
	  return;
	}
      else
	return {style: "width:" + w + "px; margin-left:-" + w + "px"};
    },
    mlwrap: function() {
       //console.log("Trace - messageCatalog helper mlwrap (messageCatalog.js,251)");
      //console.log("mlwrap -> ");
      //return "200px";
      var wid = Session.get("labelBarWidth")+"px";
      console.log("mlwrap -> ", wid);
      return wid;
    }
  });
/*
  Template.messageCatalog.helpers({
    numSelectedEmails: function() 
    {
      // If a message is being shown, it is implicitly the selection.
      if (Session.get("page") == "message") return 1;
      return Session.get("numCheckedEmails"); 
    }
  });
*/
Template.registerHelper('numSelectedEmails', function() 
  {
    //console.log("Trace - Templage helper numSelectedEmails (messageCatalog.js,271)");
    // If a message is being shown, it is implicitly the selection.
    if (Session.get("page") == "message") return 1;
    return Session.get("numCheckedEmails"); 
  });


//dumpLabels = function(username)
//  {
//  var lbl = Labels.find({user: username }, {});
//  iter.forEach(function(x) { print("name: " + x.name + " unread: " + x.unread); });
//  }
//

Template.labelList.helpers({
  unreadcount: function ()
  {
    //console.log("Trace - labelList helper unreadcount (messageCatalog.js,288)");
    //var count = Messages.find({owner: globals.username, $or: [{labels: this._id},{attrs: this._id}], attrs: globals.labelIds.unread}).count();
    //console.log("Counting unread messages");
    var sesName = "unread_in_"+this._id;
    var count = Session.get(sesName);
    //console.log(sesName + " has " + count);
    if (count == 0)
      return;
    else
      return '(' + count + ')';
  },
  messageLabels: function()
    {
     //console.log("Trace - labelList helper messageLabels (messageCatalog.js,301)");
   //return Labels.find({user: globals.username }, {});

      //For some reason, sort and toArray are causing exceptions.  So I'm 
      // writing my own.
      console.log("MessageLabels helper called");// 1, width " + Session.get("labelBarWidth"));
      var labls = Labels.find({user: globals.username, parent: null});
      var labs = labls.map(function(d) {return d;});  //toArray
      //Sort results, keeping builtin labels first
      labs.sort( function(a,b) { return (a.builtin==b.builtin ? a.name.localeCompare(b.name) : (a.builtin ? -1: 1)); });
      for (var i=0;i<labs.length;i++)
      {
	//console.log(labs[i].name);
	if (labs[i].expanded == true)  //insert new labels after parent
	{
	  var ins = Labels.find({user: globals.username, parent: labs[i]._id});
	  if (ins.count() == 0) continue;
	  var insr = ins.map(function(d) {return d;});  //toArray
	  insr.sort( function(a,b) { return a.name.localeCompare(b.name); });
	  //console.log(insr[0]);
	  labs = labs.slice(0,i+1).concat(insr,labs.slice(i+1));
	}
      }
      return labs;
    },
  labelStyle: function(obj)
    {
     //console.log("Trace - labelList helper labelStyle (messageCatalog.js,328)");
    //console.log("Stylin'!");
    /*
    if (Session.get("applyLabelMode"))
      {
      return "labelPicker";
      }
    else
      { */
      var ret = "labelNormal";
      if (Session.get("selectedLabel") == obj._id)
        ret = "labelSelected";
      var sesName = "unread_in_"+obj._id;
      var count = Session.get(sesName);
      //if (obj.dirty>0) ret += "Dirty";
      if (count>0) ret += "Unread";
      //console.log(obj.name + " Label Style = " + ret);
      return ret;
    //  }
    },
  expand: function() 
  {
     //console.log("Trace - labelList helper expand (messageCatalog.js,350)");
    //console.log("Checking expand for " + this._id + " for " + globals.username);
    if (Labels.find({user: globals.username, parent: this._id}).count()) //At least one sub-label
    {
      if (this.expanded)
	return "unexpand.png";
      else
	return "expand.png";
    }
    else return "blank.png";
  },
  ewidth: function()
  {
    //console.log("Trace - labelList helper ewidth (messageCatalog.js,363)");
    //console.log("level is " + this.level);
    return this.level * 15;
  },
  labelRename: function()
  {
    //console.log("Trace - labelList helper labelRename (messageCatalog.js,369)");
    return (Session.get("renamingLabel") == this._id);
  },
  labelSelected: function()
  {
    //console.log("Trace - labelList helper labelSelected (messageCatalog.js,374)");
    return (Session.get("selectedLabel") == this._id);
  },
  tagbutsrc: function()
  {
    //console.log("Trace - labelList helper tagbutsrc (messageCatalog.js,379)");
    labs = Session.get("labelFullList");
    if (labs.indexOf(this._id)!= -1)
      return "fullonbutton.png";
    labs = Session.get("labelPartList");
    if (labs.indexOf(this._id)!= -1)
      return "halfonbutton.png";
    return "greybutton.png"
  }
});

Template.labelList.events({

   "click li": function(event) 
     {
     //console.log("Trace - labelList event click li (messageCatalog.js,394)");
     var tr = event.currentTarget;
     var id = tr.id.split(".")[1];
       /*
     // There are 2 uses for the list of labels; 
     if (Session.get("applyLabelMode")) // first adding selected emails to the label
       {
       Session.set("applyLabelMode",false);
       Meteor.call("applyLabelToMessages", id, getSelectedMessages(), function(error, result) { if (error) DisplayError("server connection error"); else DisplayWarning("Applied"); } );
       }
     else  // second showing the emails in that label.
       {
*/
       if ((Session.get("selectedLabel") == id) &&
	   !Labels.findOne({user: globals.username, _id: id},{fields : {builtin:1,_id:0}}).builtin)
	 {
	   Session.set("renamingLabel",id);
	 }
       else
         {
	   forEachDisplayedMessage(function (elem) { elem.checked = false;});
           Session.set("numCheckedEmails",0);
	   Session.set("selectedLabel", id);
	   SetPage("main");  // move the page back to the messageCatalog display
         }
//       }
     },
   "click #labelAdd, click .emptyspan": function(event)
     {
     //console.log("Trace - labelList event click #labelAdd,.emptyspan (messageCatalog.js,423)");
       var labelname = "new label";
       var pid = event.target.id;
       var parent = null;

       if (pid.indexOf(".") == -1)
	 parent = null;
       else
	 parent = pid.split(".")[1];

       Meteor.call("createLabel", labelname, parent, function(error, newid)
		   {
		     if (error)
		       DisplayError("server connection error");
		     else
		     {
		       Session.set("renamingLabel", newid);
		       console.log ("Added label with id " + newid + " and parent: " + parent);
		     }
		   });
       event.stopPropagation();  //TODO: Make this browser-agnostic (doens't word in IE?)
     },
   "click #labelExpand": function (event)
     {
       //console.log("Trace - labelList event click #labelexpand (messageCatalog.js,447)");
       //Label _id is part of the containing LI element's id
       id = event.target.parentElement.id.split(".")[1];
       Meteor.call("expandLabelToggle", id, function(error, result) { if (error) DisplayError("server connection error"); else DisplayWarning(result); } ); 
       event.stopPropagation();  //TODO: Make this browser-agnostic (doens't word in IE?)
     },
  "click .taggedbutton": function (event)
     {
       //console.log("Trace - labelList event click .taggedbutton (messageCatalog.js,447)");
       var fnname;
       var wlab = event.currentTarget.id.split(".")[1];
       var flist = Session.get("labelFullList");
       var msglist = getSelectedMessages();
       var clrSelection = false;
       var labl = Labels.findOne({user: globals.username, _id: wlab});
       console.log("Clicked! " + wlab);
       if (labl.isAttr)
       {
	 if (flist.indexOf(wlab) == -1)
	   fnname="applyAttrToMessages";
	 else
	 {
	   fnname="clearAttrFromMessages";
	   if (wlab==Session.get("selectedLabel"))
	     clrSelection=true;
	 }
       }
       else if (Session.get("selectedLabel")==globals.labelIds.deleted)
       {
	 clrSelection = true;
	 fnname = "setOneLabel";
	 if (wlab==globals.labelIds.deleted)
	   //already have 'deleted' tag, since selectedLabel is 'deleted', so
	   //clicking the 'deleted' button will remove the tag (undelete)
	   wlab = globals.labelIds.inbox;  //move undeleted mail to inbox
        }
       else if (wlab==globals.labelIds.deleted)
       {
	 //must not currently have 'deleted' tag if we get here, so delete
	 clrSelection = true;
	 fnname = "setOneLabel";  //set label to 'deleted'
       }
       else if (flist.indexOf(wlab) == -1)  //label not currently on message
	 fnname = "applyLabelToMessages";
       else
       {
	 fnname = "clearLabelFromMessages";
	 //If Removing currently viewed label, uncheck items first
	 if (wlab==Session.get("selectedLabel"))
	   clrSelection = true;
       }
       if (clrSelection)
       {
	 forEachDisplayedMessage(function (elem) { elem.checked = false;});
         Session.set("numCheckedEmails",0);
	 //If in a 'message' page, the message is being moved or deleted,
	 // so go back to the main page.
	 SetPage("main");  // If already 'main' this won't affect anything.
       }
	 
       Meteor.call(fnname,wlab,msglist);
       event.stopPropagation(); 
     }
  });

Template.labelNameEdit.events({
   "keyup #labelAddInput": function(event)
    {
      //console.log("Trace - labelNameEdit event keyup #labelAddInput (messageCatalog.js,515)");
      var key=event.which;
      if (key==13)  // RETURN key
      {
	var newname = event.target.value;
	var labid = Session.get("renamingLabel");
        Session.set("renamingLabel","");
	ClearWarning();
	if (newname)
	{
	  console.log("ID: " + labid + " --> New name: " + newname);
	  Meteor.call("renameLabel", labid, newname, function(error, result) { if (error) DisplayError("server connection error"); else DisplayWarning(result); } );
	 }
       }
     },
   "blur #labelAddInput": function(event)
     {
       //console.log("Trace - labelNameEdit event blur #labelAddInput (messageCatalog.js,532)");
       var newname = event.target.value;
       var labid = Session.get("renamingLabel");
       Session.set("renamingLabel","");
       ClearWarning();
       if (newname)
	 Meteor.call("renameLabel", labid, newname, function(error, result) { if (error) DisplayError("server connection error"); else DisplayWarning(result); } );
     },
   "focus #labelAddInput": function(event)
     {
       //console.log("Trace - labelNameEdit event focus #labelAddInput (messageCatalog.js,542)");
       event.target.select();
     }
   });

  Template.labelNameEdit.rendered = function()
  {
    //console.log("Trace - labelNameEdit rendered (messageCatalog.js,549)");
    this.$('input').focus();
  }

  Template.messageList.helpers({
    messages: function ()
    { 
      //console.log("Trace - messageList helper messages (messageCatalog.js,556)");
      if (!globals || !globals.labelIds)
	return;
      var label = Session.get("selectedLabel");
      if (!label)
      {
	Session.set("selectedLabel", globals.labelIds.inbox); //this will trigger a redraw, so just return
	return [];
      }
      console.log("Messages: " + label);
      //console.log("Listing: owner: " + globals.username + " label: " + label);  
      return Messages.find({owner: globals.username, $or: [{labels: label},{attrs: label}]}, {skip:Session.get("messageOffset"), limit: Session.get("userData").messagesPerPage });    
    },
    decrypt: function(key,data)
      {
      //console.log("Trace - messageList helper decrypt (messageCatalog.js,571)");
      var ud = Session.get("userData");
      for(var i = 0; i<ud.keys.length; i++)
        {
        try
          {
          var realkey = ecc.decrypt(ud.keys[i].sec,key);
          }
        catch(e)
          {
          }
        try
          {
          return sjcl.decrypt(realkey,data);
          }
        catch (e)
          {
          }
        }

      // check cleartext
      try
          {
          return sjcl.decrypt(key,data);
          }
      catch (e)
          {
          }

      return "<indecipherable>";
      },
    dateDisplay: function(date) { return dateDisplay(date); },
    personDisplay: function(person) { return personDisplay(person); }
  });


Template.messageList.events
  ({

    'mousemove .emailSummary': function(event)
      {
      var div = event.currentTarget;
      var style = div.getAttributeNode("style");
      if (style)
        {
        style.value = "color:red";
        }
      },

    'mouseout .emailSummary': function(event)
      {
      var div = event.currentTarget;
      var style = div.getAttributeNode("style");
      if (style)
        {
        style.value = "color:black";
        }

      },
    'click #allEmails': function(event)
      {
      //console.log("Trace - messageList event click #allEmails (messageCatalog.js,632)");
      var countArray = forEachDisplayedMessage(function (elem) { elem.checked = event.currentTarget.checked; return elem; });
      if (!event.currentTarget.checked)
        {
        Session.set("numCheckedEmails",0);
        }
      else
        {
        Session.set("numCheckedEmails",countArray.length);
        }
      event.stopPropagation();
      },
    'click .summaryCheckBox': function(event)
      {
      //console.log("Trace - messageList event click .summaryCheckBox (messageCatalog.js,646)");
      if (event.currentTarget.checked)
        {
        Session.set("numCheckedEmails",Session.get("numCheckedEmails")+1);        
        }
      else
        {
        Session.set("numCheckedEmails",Session.get("numCheckedEmails")-1);        
        }
      event.stopPropagation();
      },
    'click .emailSummary': function(event)
      {
        //console.log("Trace - messageList event click .emailSummary (messageCatalog.js,659)");
        var line = event.currentTarget;
        var emailId = line.id;
        //console.log(line.id);
	forEachDisplayedMessage(function (elem) { elem.checked = false;});
        Session.set("numCheckedEmails",-1);
        Session.set("curMessage",line.id);
        SetPage("message");
	//Meteor.call("clearLabelFromMessages", globals.labelIds.unread, [emailId] );
      }
  });
