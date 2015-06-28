# Flybase-Import

Flybase-import is a helper utility for importing large JSON files into [Flybase](https://www.flybase.io/). It 
breaks the JSON into smaller chunks and uploads them individually through the Data MCFly API.

## Installing

Install the flybase-import module globally:

    $ npm install -g flybase-import

or install it locally and add it to your path:

    $ npm install flybase-import
    $ export PATH=$PATH:`npm bin`

## Usage

    $ flybase-import
    Usage: flybase-import

    Options:
      --flybase_key, -k          Flybase API Key.                                                          [required]
      --flybase_app, -a          Flybase App name.                                                         [required]
      --flybase_collection, -c   Flybase collection name.                                                  [required]
      --json, -j                   The JSON file to import.                                                     [required]
      --merge, -m                  Add the records to the collection without overwriting the whole collection.  [boolean]
      --force                      Don't prompt before overwriting data.                                        [boolean]


## Example

    $ flybase-import --flybase_key API-KEY --flybase-app Test --flybase_collection Stuff --json test.json
    All data at Test/Stuff will be overwritten.
    Press <enter> to proceed, Ctrl-C to abort.

    Reading /Users/roger/test.json... (may take a minute)
    Preparing JSON for import... (may take a minute)
    Importing [=================================================] 100% (9431/9431)
    Import completed.

Or an example of merging the contents of test.json with what's already in your collection:

    $ flybase-import --flybase_key API-KEY --flybase-app Test --flybase_collection Stuff --json test.json --merge
    Each document in test.json will be written under Test/Stuff.  If a document already exists, it will be overwritten.
    If a record already exists, it will be overwritten.
    Press <enter> to proceed, Ctrl-C to abort.

    Reading /Users/roger/test.json... (may take a minute)
    Preparing JSON for import... (may take a minute)
    Importing [=================================================] 100% (9431/9431)
    Import completed.