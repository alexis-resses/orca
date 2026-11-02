<?php

declare(strict_types=1);

namespace App\Service;

use App\Greeter;

final class Mailer
{
    public function __construct(private Greeter $greeter)
    {
    }

    public function welcome(string $recipient): string
    {
        return $this->greeter->greet($recipient);
    }
}
