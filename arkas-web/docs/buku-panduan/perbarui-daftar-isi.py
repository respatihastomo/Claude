import sys, time, subprocess, os, uno
from com.sun.star.beans import PropertyValue
masuk, keluar_docx, keluar_pdf = [os.path.abspath(x) for x in sys.argv[1:4]]
prof = '/tmp/lo_prof_toc'
p = subprocess.Popen(['soffice', '--headless', '--norestore', '--nologo', f'-env:UserInstallation=file://{prof}', '--accept=socket,host=127.0.0.1,port=2002;urp;'])
ctx = None
for _ in range(60):
    try:
        lc = uno.getComponentContext(); r = lc.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', lc)
        ctx = r.resolve('uno:socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext'); break
    except Exception: time.sleep(1)
def pv(n, v): x = PropertyValue(); x.Name = n; x.Value = v; return x
desk = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
doc = desk.loadComponentFromURL(uno.systemPathToFileUrl(masuk), '_blank', 0, (pv('Hidden', True),))
idx = doc.getDocumentIndexes()
for i in range(idx.getCount()): idx.getByIndex(i).update()
doc.refresh()
for i in range(idx.getCount()): idx.getByIndex(i).update()
doc.storeToURL(uno.systemPathToFileUrl(keluar_docx), (pv('FilterName', 'MS Word 2007 XML'),))
doc.storeToURL(uno.systemPathToFileUrl(keluar_pdf), (pv('FilterName', 'writer_pdf_Export'),))
print('indeks', idx.getCount())
doc.close(True)
try: desk.terminate()
except Exception: pass
p.wait(timeout=30)
