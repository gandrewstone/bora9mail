import string
import codecs
def main():
  inn = codecs.open("names.csv","r","utf-16")
  out = open("names.js","wt")
  """  munge = []
  for name in inn.readlines():
    out = []
    for ch in unicode(name):
      if ch in string.printable:
        out.append(ch)
    munge.append("".join(out))
  """
  names = inn.readlines();
  names = [ '"%s"' % x.strip() for x in names] 
  out.write("reservedNames = [")
  out.write(",".join(names))
  out.write("];")

  out.close();
  inn.close();
    
main()
