<?php

require_once __DIR__ . '/Customer.php';

class Invoice
{
    /**
     * Returns the customer billed by this invoice.
     *
     * @return Customer
     */
    public function documentedCustomer()
    {
        return new Customer();
    }

    public function undocumentedCustomer()
    {
        return new Customer();
    }

    public function total()
    {
        return 42.0;
    }
}
