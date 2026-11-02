<?php

declare(strict_types=1);

namespace App;

final class Greeter
{
    /**
     * Builds the greeting shown to a user.
     *
     * @param string $name Name of the person to greet.
     * @return string The greeting.
     */
    public function greet(string $name): string
    {
        return "Hello, {$name}!";
    }
}
