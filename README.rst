OpenLayers 3 + POST + RequireJS
===============================
    
Adds the option of sending tile requests using POST
(as well as still using GET).

Fixes a conflict with RequireJS that makes loading
``ol-debug.js`` fail because of ``rbush``.

.. WARNING:: This project is still not complete.
             I'm pushing *too soon*.
             
             (The AMD/rbush fix does work,
             but currently the POST feature is still a baby.)

Features/Musings
----------------

Why POST?
^^^^^^^^^

Because a project's request URL might otherwise be greater
than the lowest common denominator 2,083 character limit
`imposed by IE8
<https://support.microsoft.com/en-us/kb/208427>`__.

Although, even if the request limit might be the next
`LCD
<https://en.wikipedia.org/wiki/Lowest_common_denominator>`__,
which is 65,536, not all servers accept large GET request strings.
See `boutell's urllength
<http://www.boutell.com/newfaq/misc/urllength.html>`__
for a list of clients and servers and their url limits.

Also, POST requests can be unlimited, so having an
`a priori
<https://tools.ietf.org/html/rfc2616#section-3.2.1>`__
mandate seems unreasonable, especially considering that
there's no way of knowing what kind of request data might
need to be sent from client to server
(e.g., spatial queries,
`Don Quixote <https://en.wikipedia.org/wiki/Don_Quixote>`__,
etc.).

Alternatives to POST
++++++++++++++++++++

The client could POST the tile query data *before* issuing the
tile GET request. The server would have to cache the request and
return a token to the client to use in the next (and possibly
subsequent) tile request(s).

- This solution seems unnecessarily complicated,
  especially since OpenLayers already caches requests.
  You don't get any performance gain; you get
  bragging rights to a more complicated implementation.

What's Wrong with OpenLayers and RequireJS and rbush?
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

If a project uses RequireJs to load OpenLayer 3, loading ``ol-debug.js``
fails on ``Uncaught TypeError: ol.ext.rbush is not a function``.

The production build, ``ol.js``, works fine.

The problem is that the external ``rbush`` library checks
on the ``define.amd`` object and attribute and sees that it's
set, so it exports itself amd-style. But ``goog.require``
expects it to be exported goog-style.

The reason the release build works is because the reference
to ``define.amd`` is mangled in the release build,
e.g., it looks like ``define.Mo``, so the rbush module is
then exported goog-style.

- See the modified
  `rbush module
  <https://github.com/landonb/rbush/tree/v1.4.0-lb>`__
  and
  `the modified lines
  <https://github.com/landonb/rbush/blob/v1.4.0-lb/rbush.js#L611>`__.

.. note:: **FIXME**: The author needs to
          `open a ticket with rbush
          <https://github.com/mourner/rbush/issues>`__.
          If they accept that patch, the
          `npm registry
          <https://www.npmjs.com/package/rbush>`__
          will be updated, and then the stock
          `OpenLayers
          <https://github.com/openlayers/ol3>`__
          project will work.
          But I'm busy on a work deadline and can't wait,
          so I've just cloned those projects and moved along.
          
          Also, fixing rbush for an
          AMD-project-that-imports-a-Closure-project-that-imports-rbush
          will probably break rbush for the reverse, that is, a
          Closure-project-that-imports-an-AMD-project-that-imports-rbush
          might break if the rbush team accepts this patch. Ideally,
          the rbush code -- since it's part of an import progression,
          or whatever it's called -- should let the caller tell it how
          to export itself.

The OL3/AMD/rbush issue is being tracked in OpenLayers as
`requirejs optimization issue with ol3 (#3274)
<https://github.com/openlayers/ol3/issues/3274>`__.

Unresolved Issues
^^^^^^^^^^^^^^^^^

The debug build is sometimes known to not draw ``ol.source.Vector``
linestrings, and those layers, albeit transparent when drawn, can
obscure other layers, such as label layers created with ``ol.layer.Image``.
At least in this author's experience.

Compiling on Debian/Ubuntu/Linux Mint
-------------------------------------

The OL3 compilation instructions omit problems encountered in Debian distros.

Hence these instructions.

.. note:: These instructions have *only* been tested on Linux Mint 17.1.
          But the author guesses they'll work in Ubuntu, tuu.

.. note:: On Ubuntu 12.04 LTS in a chroot, the ``npm install``
          command fails while trying to download files.
          The author is not aware if this is a chroot problem
          or an old-distro problem.

Install build tools
^^^^^^^^^^^^^^^^^^^

.. code-block:: bash

    sudo apt-get install default-jdk
    sudo apt-get install default-jre
    sudo apt-get install nodejs
    sudo apt-get install npm

Debian renames the node executable, but the OL3 code doesn't know that.
So fake it.

.. code-block:: bash

    sudo /bin/ln -s /usr/bin/nodejs /usr/bin/node

Here's the quickest way to build the OL3 library.

.. code-block:: bash

    # cd some/where
    npm install landonb/ol3
    cd ol3/node_modules/openlayers
    sudo pip2 install -r requirements.txt

You can alternatively use easy_install:
``cat requirements.txt | sudo xargs easy_install``
but most sane people no longer use easy_install.

You can also clone the repository manually or extract it from
an archive, in which case instead of ``npm install landonb/ol3``
you'll simply run ``npm install`` after cloning or unpacking.
(And try ``make check-deps`` if you want to check that java,
node, and npm are installed.)

Build the code
^^^^^^^^^^^^^^

.. note:: On the first build, npm will download all of the remote
          dependencies. So the first build always takes longer.

This is easy.

.. code-block:: bash

    make build

And that's it.

If you want to create smaller binaries, create an ``ol.json``
file and specify exactly which features (classes and functions)
you'd like packaged.

- See `Creating custom builds
  <http://openlayers.org/en/v3.5.0/doc/tutorials/custom-builds.html>`__

Other make commands include:

- ``make clean`` - run this if you edit third-party code and want to re-build.

- ``make server`` - run this is you want a simple server to test your code against.

- ``make lint`` - run this to check your code, especially important
  if you want to `contribute to OpenLayers development
  <https://github.com/openlayers/ol3/blob/master/CONTRIBUTING.md>`__.

- ``make test`` - run this if you plan to contribute patches.

- ``make check`` - always run this before asking OL3 devs to pull your code.

