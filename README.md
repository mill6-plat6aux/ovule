<div align="center">
    <div>
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="images/title-w.svg"/>
            <img src="images/title.svg" width="320"/>
        </picture>
    </div>
    Product Footprint Management System
    <br/><br/>
</div>


This application is the product footprint management system implemented in strict accordance with [the technical specifications](https://wbcsd.github.io/tr/data-exchange-protocol/) defined by WBCSD/PACT.

Please note, however, that it is **not** certified by WBCSD/PACT.

You may use this application under [the license](LICENSE). If you need support, please post to [the forum](https://github.com/mill6-plat6aux/ovule/issues) of this repository.


## Requirements

* Docker 20.10 later

If Node.js is not installed on your system, see [here](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs).


## Launch Database & Server

```sh
docker compose up
```

## Launch Client

Access the following URL using a web browser.

```
http://localhost:8080/client/
```

For an account, see `database/demo1/users.sql`.

## License

[MIT](LICENSE)


## Developers

[Takuro Okada](mailto:mill6.plat6aux@gmail.com)


---

&copy; Takuro Okada