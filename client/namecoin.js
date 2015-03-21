
namecoinFullName = function(nc)
  {
  var data = nc.value;
  if (data.v == "0.3")
    {
    return data.basics.name;
    }  
  return null;
  }

namecoinAvatar = function(nc)
  {
  var data = nc.value;
  if (data.v == "0.3")
    {
    var photos = data.photos;
    for (var i = 0 ;i < photos.length; i++)
      {
      if (photos[i].type == "avatar")
        {
        return photos[i].url;
        }
      }
    }
  }

namecoinPublicKey = function(nc)
  {
  // DEBUG
  var thisSite = "something" // "bora9";
  var pubk = data.extensions[thisSite];

  // DEBUG
  if (pubk == "se")
    {
    pubk = "IDK";
    }
  return pubk;
  }
