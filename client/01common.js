bSet = function() { this.test = "foo"; }

bSet.prototype.add = function(a) { this[a] = true; }
bSet.prototype.del = function(a) { delete this[a]; }
