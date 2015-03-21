
// At initialization, let's see if we can talk to the namecoin server
jsonRpc(NAMECOIN_OPTIONS,"getblockcount",[],
  function (result) 
    { 
    console.log("Namecoin connection OK.  Current block count is: " + JSON.stringify(result)); 
    },
  function (result) 
    {
    console.log("ERROR!  Namecoin connection problem:  " + JSON.stringify(result)); 
    },null);

//jsonRpc(NAMECOIN_OPTIONS,"name_show",["u/naval"],function (result) { console.log(JSON.stringify(result)); },function (result) {console.log(JSON.stringify(result)); },null);


// Wrap namecoin functions in a nice callable manner.
namecoin = {
  name_show: function(name, worked, error)
    {
    jsonRpc(NAMECOIN_OPTIONS,"name_show",[name],worked,error,null);
    }
  }
